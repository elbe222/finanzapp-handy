/*
 * speicher_v001.js – Finanzapp Handy (H1: Einträge nur auf dem Handy speichern)
 *
 * Alles liegt im Speicher des Browsers bzw. der installierten App auf diesem
 * Handy (localStorage). Nichts geht ins Internet, nichts liegt bei GitHub.
 *
 * Schlüssel (mit Präfix, weil alle GitHub-Pages-Seiten eines Kontos denselben
 * Speicherbereich teilen):
 *   fa-handy:eintraege    – aktuelle, noch nicht exportierte Einträge
 *   fa-handy:exporte      – die letzten Exporte (zum erneuten Speichern / Zurückholen)
 *   fa-handy:vorschlaege  – zuletzt benutzte Kategorien, Gruppen und deren Zuordnung
 *   fa-handy:einstellungen – kleine Merker (z. B. Installations-Hinweis ausgeblendet)
 *
 * Eintrag: {id, datum:"JJJJ-MM-TT", typ:"Einnahme"|"Ausgabe"|"Investment",
 *           rueckfluss:""|"ja", betrag:Zahl, beschreibung, kategorie, gruppe,
 *           steuerrelevant:true|false, erstellt:ms, geaendert:ms}
 */
(function (global) {
    "use strict";

    var P = "fa-handy:";
    var MAX_EXPORTE = 5;
    var MAX_VORSCHLAEGE = 60;
    var TYPEN = ["Einnahme", "Ausgabe", "Investment"];

    var verfuegbar = (function () {
        try {
            var k = P + "test";
            global.localStorage.setItem(k, "1");
            global.localStorage.removeItem(k);
            return true;
        } catch (e) {
            return false;
        }
    })();

    // Fallback, falls der Speicher gesperrt ist (z. B. privater Modus): nur bis zum Schließen
    var fluechtig = {};

    function lesen(name, standard) {
        try {
            var roh = verfuegbar ? global.localStorage.getItem(P + name) : fluechtig[name];
            if (roh == null) { return standard; }
            var wert = JSON.parse(roh);
            return wert == null ? standard : wert;
        } catch (e) {
            return standard;
        }
    }

    /** Gibt true zurück, wenn gespeichert werden konnte. */
    function schreiben(name, wert) {
        var text = JSON.stringify(wert);
        if (!verfuegbar) { fluechtig[name] = text; return false; }
        try {
            global.localStorage.setItem(P + name, text);
            return true;
        } catch (e) {
            return false;
        }
    }

    function neueId() {
        if (global.crypto && global.crypto.randomUUID) { return global.crypto.randomUUID(); }
        return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
    }

    /** Bereinigt einen Eintrag (Formular -> Speicherform). */
    function normiere(e) {
        var typ = TYPEN.indexOf(e.typ) >= 0 ? e.typ : "Ausgabe";
        return {
            id: e.id || neueId(),
            datum: String(e.datum || ""),
            typ: typ,
            rueckfluss: typ === "Investment" && e.rueckfluss === "ja" ? "ja" : "",
            betrag: Math.round(Number(e.betrag) * 100) / 100,
            beschreibung: String(e.beschreibung || "").trim(),
            kategorie: String(e.kategorie || "").trim(),
            gruppe: String(e.gruppe || "").trim(),
            steuerrelevant: !!e.steuerrelevant,
            erstellt: e.erstellt || Date.now(),
            geaendert: Date.now()
        };
    }

    // ------------------------------------------------------------------ Einträge

    function alle() {
        var liste = lesen("eintraege", []);
        return Array.isArray(liste) ? liste : [];
    }

    function sortiert() {
        return alle().sort(function (a, b) {
            if (a.datum !== b.datum) { return a.datum < b.datum ? 1 : -1; }
            return (b.erstellt || 0) - (a.erstellt || 0);
        });
    }

    function holen(id) {
        return alle().filter(function (e) { return e.id === id; })[0] || null;
    }

    function hinzufuegen(daten) {
        var e = normiere(daten);
        var liste = alle();
        liste.push(e);
        var ok = schreiben("eintraege", liste);
        vorschlagMerken(e.kategorie, e.gruppe);
        return { eintrag: e, gespeichert: ok };
    }

    function aendern(id, daten) {
        var liste = alle();
        for (var i = 0; i < liste.length; i++) {
            if (liste[i].id === id) {
                daten.id = id;
                daten.erstellt = liste[i].erstellt;
                liste[i] = normiere(daten);
                var ok = schreiben("eintraege", liste);
                vorschlagMerken(liste[i].kategorie, liste[i].gruppe);
                return { eintrag: liste[i], gespeichert: ok };
            }
        }
        return { eintrag: null, gespeichert: false };
    }

    /** Löscht einen Eintrag und gibt ihn zurück (für „Rückgängig“). */
    function loeschen(id) {
        var liste = alle();
        var weg = null;
        liste = liste.filter(function (e) {
            if (e.id === id) { weg = e; return false; }
            return true;
        });
        schreiben("eintraege", liste);
        return weg;
    }

    /** Fügt Einträge wieder ein (Rückgängig / aus einem Export zurückholen). Doppelte ids werden übersprungen. */
    function zurueckholen(eintraege) {
        var liste = alle();
        var da = {};
        liste.forEach(function (e) { da[e.id] = true; });
        var neu = 0;
        eintraege.forEach(function (e) {
            if (!da[e.id]) { liste.push(e); da[e.id] = true; neu++; }
        });
        schreiben("eintraege", liste);
        return neu;
    }

    // ------------------------------------------------------------------ Exporte

    function exporte() {
        var liste = lesen("exporte", []);
        return Array.isArray(liste) ? liste : [];
    }

    /**
     * Nach dem Export: die exportierten Einträge verschwinden aus der Liste und
     * werden als „letzter Export“ aufbewahrt (die letzten 5), damit man die Datei
     * nochmal speichern oder die Einträge zurückholen kann.
     */
    function exportAbschliessen(eintraege, dateiname) {
        var ids = {};
        eintraege.forEach(function (e) { ids[e.id] = true; });
        var rest = alle().filter(function (e) { return !ids[e.id]; });
        var liste = exporte();
        var eintrag = { id: neueId(), zeit: Date.now(), datei: dateiname, eintraege: eintraege };
        liste.unshift(eintrag);
        liste = liste.slice(0, MAX_EXPORTE);
        var ok = schreiben("exporte", liste);
        if (!ok) {
            // Speicher voll: ältere Exporte opfern, die Einträge selbst sind wichtiger
            liste = [eintrag];
            ok = schreiben("exporte", liste);
        }
        schreiben("eintraege", rest);
        return eintrag;
    }

    function exportHolen(id) {
        return exporte().filter(function (x) { return x.id === id; })[0] || null;
    }

    /** Holt die Einträge eines Exports zurück in die Liste und entfernt den Export aus dem Archiv. */
    function exportZurueckholen(id) {
        var x = exportHolen(id);
        if (!x) { return 0; }
        var n = zurueckholen(x.eintraege || []);
        schreiben("exporte", exporte().filter(function (y) { return y.id !== id; }));
        return n;
    }

    // ------------------------------------------------------------------ Vorschläge

    function vorschlaege() {
        var v = lesen("vorschlaege", null) || {};
        return {
            kategorien: Array.isArray(v.kategorien) ? v.kategorien : [],
            gruppen: Array.isArray(v.gruppen) ? v.gruppen : [],
            zuordnung: v.zuordnung && typeof v.zuordnung === "object" ? v.zuordnung : {}
        };
    }

    function vorne(liste, wert) {
        var klein = wert.toLocaleLowerCase("de");
        liste = liste.filter(function (x) { return x.toLocaleLowerCase("de") !== klein; });
        liste.unshift(wert);
        return liste.slice(0, MAX_VORSCHLAEGE);
    }

    function vorschlagMerken(kategorie, gruppe) {
        if (!kategorie && !gruppe) { return; }
        var v = vorschlaege();
        if (kategorie) { v.kategorien = vorne(v.kategorien, kategorie); }
        if (gruppe) { v.gruppen = vorne(v.gruppen, gruppe); }
        if (kategorie && gruppe) { v.zuordnung[kategorie] = gruppe; }
        schreiben("vorschlaege", v);
    }

    function vorschlaegeLoeschen() {
        schreiben("vorschlaege", { kategorien: [], gruppen: [], zuordnung: {} });
    }

    // ------------------------------------------------------------------ Merker

    function merker(name, wert) {
        var m = lesen("einstellungen", {}) || {};
        if (arguments.length > 1) { m[name] = wert; schreiben("einstellungen", m); }
        return m[name];
    }

    var api = {
        verfuegbar: verfuegbar,
        TYPEN: TYPEN,
        alle: alle,
        sortiert: sortiert,
        holen: holen,
        hinzufuegen: hinzufuegen,
        aendern: aendern,
        loeschen: loeschen,
        zurueckholen: zurueckholen,
        exporte: exporte,
        exportHolen: exportHolen,
        exportAbschliessen: exportAbschliessen,
        exportZurueckholen: exportZurueckholen,
        vorschlaege: vorschlaege,
        vorschlaegeLoeschen: vorschlaegeLoeschen,
        merker: merker
    };
    global.FAspeicher = api;
})(window);
