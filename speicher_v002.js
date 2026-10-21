/*
 * speicher_v002.js – Finanzapp Handy (H1: Einträge nur auf dem Handy speichern; v2: Kategorien vom PC)
 *
 * Alles liegt im Speicher des Browsers bzw. der installierten App auf diesem
 * Handy (localStorage). Nichts geht ins Internet, nichts liegt bei GitHub.
 *
 * Schlüssel (mit Präfix, weil alle GitHub-Pages-Seiten eines Kontos denselben
 * Speicherbereich teilen):
 *   fa-handy:eintraege    – aktuelle, noch nicht exportierte Einträge
 *   fa-handy:exporte      – die letzten Exporte (zum erneuten Speichern / Zurückholen)
 *   fa-handy:vorschlaege  – zuletzt benutzte Kategorien, Gruppen und deren Zuordnung
 *   fa-handy:einstellungen – kleine Merker (z. B. Installations-Hinweis ausgeblendet, Erinnerung nach x Tagen)
 *   fa-handy:pc           – (v2) Kategorien und Kategoriegruppen vom PC (per QR-Code übernommen)
 *   fa-handy:aussehen     – (v2) Hell/Dunkel, Farbschema, Zahlenfarben (siehe farben_v001.js)
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
        merker("letzterExport", Date.now());
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

    // ------------------------------------------------------------------ v2: Kategorien vom PC

    function klein(t) { return String(t || "").toLocaleLowerCase("de"); }

    /** {stand:"JJJJ-MM-TT", geladen:ms, gruppen:[...], kategorien:[{name, gruppe}]} oder null */
    function pc() {
        var p = lesen("pc", null);
        if (!p || !Array.isArray(p.kategorien) || !Array.isArray(p.gruppen)) { return null; }
        return p;
    }

    /** Übernimmt das Paket vom PC (siehe handy_qr_v001.py): {v, d, g:[...], k:[[name, gruppenIndex]], a} */
    function pcUebernehmen(paket) {
        var gruppen = (paket.g || []).map(function (g) { return String(g).trim(); }).filter(Boolean);
        var kategorien = [];
        (paket.k || []).forEach(function (x) {
            var name = String((x && x[0]) || "").trim();
            if (!name) { return; }
            var gi = x[1];
            kategorien.push({ name: name, gruppe: (typeof gi === "number" && gi >= 0 && gi < gruppen.length) ? gruppen[gi] : "" });
        });
        var alt = pc();
        var vorher = {};
        if (alt) { alt.kategorien.forEach(function (k) { vorher[klein(k.name)] = true; }); }
        var neu = kategorien.filter(function (k) { return !vorher[klein(k.name)]; }).length;
        var daten = { stand: String(paket.d || ""), geladen: Date.now(), gruppen: gruppen, kategorien: kategorien };
        var ok = schreiben("pc", daten);
        return { gespeichert: ok, kategorien: kategorien.length, gruppen: gruppen.length, neu: neu, erstmals: !alt };
    }

    /**
     * Wohin gehört eine Kategorie? Zuerst wie am PC (die Kategorie bestimmt die Gruppe), sonst die
     * auf dem Handy zuletzt benutzte Gruppe. Rückgabe: {name (Schreibweise wie gespeichert), gruppe, quelle:"pc"|"handy"} oder null
     */
    function kategorieInfo(name) {
        var k = klein(String(name || "").trim());
        if (!k) { return null; }
        var p = pc();
        if (p) {
            for (var i = 0; i < p.kategorien.length; i++) {
                if (klein(p.kategorien[i].name) === k) {
                    return { name: p.kategorien[i].name, gruppe: p.kategorien[i].gruppe, quelle: "pc" };
                }
            }
        }
        var v = vorschlaege();
        var treffer = null;
        v.kategorien.forEach(function (x) { if (!treffer && klein(x) === k) { treffer = x; } });
        Object.keys(v.zuordnung).forEach(function (x) { if (klein(x) === k) { treffer = treffer || x; } });
        if (!treffer) { return null; }
        var gruppe = "";
        Object.keys(v.zuordnung).forEach(function (x) { if (klein(x) === k) { gruppe = v.zuordnung[x]; } });
        return { name: treffer, gruppe: gruppe, quelle: "handy" };
    }

    /** Alle Kategorien für die Auswahl: [{name, gruppe, quelle}] – vom PC und die nur auf dem Handy benutzten. */
    function alleKategorien() {
        var liste = [], da = {};
        var p = pc();
        if (p) {
            p.kategorien.forEach(function (x) {
                if (da[klein(x.name)]) { return; }
                da[klein(x.name)] = true;
                liste.push({ name: x.name, gruppe: x.gruppe, quelle: "pc" });
            });
        }
        var v = vorschlaege();
        v.kategorien.forEach(function (name) {
            if (da[klein(name)]) { return; }
            da[klein(name)] = true;
            var info = kategorieInfo(name);
            liste.push({ name: name, gruppe: info ? info.gruppe : "", quelle: "handy" });
        });
        return liste;
    }

    /** Alle bekannten Gruppen (PC + Handy) für das Gruppenfeld bei neuen Kategorien. */
    function alleGruppen() {
        var liste = [], da = {};
        var p = pc();
        (p ? p.gruppen : []).concat(vorschlaege().gruppen).forEach(function (g) {
            if (g && !da[klein(g)]) { da[klein(g)] = true; liste.push(g); }
        });
        return liste;
    }

    /** Die zuletzt benutzten Kategorien (neueste zuerst). */
    function zuletzt(anzahl) {
        return vorschlaege().kategorien.slice(0, anzahl || 5);
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
        merker: merker,
        pc: pc,
        pcUebernehmen: pcUebernehmen,
        kategorieInfo: kategorieInfo,
        alleKategorien: alleKategorien,
        alleGruppen: alleGruppen,
        zuletzt: zuletzt
    };
    global.FAspeicher = api;
})(window);
