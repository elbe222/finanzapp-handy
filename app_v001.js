/*
 * app_v001.js – Finanzapp Handy, Version 1
 *
 * H1  Einträge erfassen (Name, Datum, Art inkl. Investment/Geld zurück, Betrag,
 *     Kategorie, Kategoriegruppe, Steuerrelevant) – Felder wie in der WebApp
 * H2  Liste der Einträge auf dem Handy mit Summen, Suche, Bearbeiten, Löschen (+ Rückgängig)
 * H3  Excel-Export im Format der WebApp-Importvorlage; danach verschwinden die
 *     Einträge vom Handy (die letzten 5 Exporte bleiben zum Nachspeichern/Zurückholen)
 * H4  Anleitung, Installations-Hinweis, Update-Hinweis, offline nutzbar
 *
 * Benötigt: speicher_v001.js (FAspeicher), xlsx_v001.js (FAxlsx)
 */
(function () {
    "use strict";

    var S = window.FAspeicher;
    var X = window.FAxlsx;
    var $ = function (sel, wurzel) { return (wurzel || document).querySelector(sel); };
    var $$ = function (sel, wurzel) { return Array.prototype.slice.call((wurzel || document).querySelectorAll(sel)); };

    // ------------------------------------------------------------------ Formatierung (wie WebApp)

    var zahlFormat = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    /** wie zahlen_v001.format_euro der WebApp: Tausenderpunkt, Komma, echtes Minuszeichen */
    function euro(wert) {
        var text = zahlFormat.format(Math.abs(wert));
        return (wert < 0 && text !== "0,00" ? "\u2212" : "") + text + " €";
    }

    function datumText(iso) {
        var t = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
        return t ? t[3] + "." + t[2] + "." + t[1] : (iso || "");
    }

    function heute() {
        var d = new Date();
        return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }

    function istRein(e) { return e.typ === "Einnahme" || (e.typ === "Investment" && e.rueckfluss === "ja"); }

    function farbKlasse(e) {
        if (e.typ === "Investment") { return "investiert"; }
        return e.typ === "Einnahme" ? "einnahmen" : "ausgaben";
    }

    function betragText(e) { return (istRein(e) ? "+" : "−") + euro(e.betrag); }

    /** "1.234,56" / "49,99" / "49.99" / "12 €" -> Zahl oder null (gleiche Regeln wie der WebApp-Import) */
    function leseBetrag(text) {
        var s = String(text || "").replace(/eur|€|\s/gi, "");
        if (!s) { return null; }
        if (s.indexOf(",") >= 0 && s.indexOf(".") >= 0) { s = s.replace(/\./g, "").replace(",", "."); }
        else if (/^\d{1,3}(\.\d{3})+$/.test(s)) { s = s.replace(/\./g, ""); }   // "1.234" = 1234 (Tausenderpunkt)
        else { s = s.replace(",", "."); }
        if (!/^\d*\.?\d+$|^\d+\.$/.test(s)) { return NaN; }
        var w = parseFloat(s);
        return isFinite(w) ? Math.round(w * 100) / 100 : NaN;
    }

    function el(tag, klasse, text) {
        var e = document.createElement(tag);
        if (klasse) { e.className = klasse; }
        if (text != null) { e.textContent = text; }
        return e;
    }

    // ------------------------------------------------------------------ Toast

    var toastZeit = null;
    function toast(text, aktionText, aktion, dauer) {
        var t = $("[data-toast]");
        var knopf = $("[data-toast-aktion]");
        $("[data-toast-text]").textContent = text;
        knopf.hidden = !aktion;
        knopf.textContent = aktionText || "";
        knopf.onclick = aktion ? function () { t.hidden = true; aktion(); } : null;
        t.hidden = false;
        t.classList.remove("ist-weg");
        clearTimeout(toastZeit);
        toastZeit = setTimeout(function () { t.hidden = true; }, dauer || (aktion ? 7000 : 3500));
    }

    function speicherFehler(ok) {
        if (ok === false && S.verfuegbar) {
            toast("Achtung: Der Speicher des Handys ist voll – bitte jetzt exportieren.", null, null, 8000);
        }
    }

    // ------------------------------------------------------------------ Ansichten (#neu, #liste, #export, #hilfe)

    var ANSICHTEN = ["neu", "liste", "export", "hilfe"];
    var bearbeiteId = null;

    function aktuelleAnsicht() {
        var h = (location.hash || "").replace("#", "");
        return ANSICHTEN.indexOf(h) >= 0 ? h : "neu";
    }

    function zeigeAnsicht() {
        var a = aktuelleAnsicht();
        $$("[data-ansicht]").forEach(function (s) { s.hidden = s.getAttribute("data-ansicht") !== a; });
        $$("[data-tab]").forEach(function (t) {
            var an = t.getAttribute("data-tab") === a;
            t.classList.toggle("ist-aktiv", an);
            if (an) { t.setAttribute("aria-current", "page"); } else { t.removeAttribute("aria-current"); }
        });
        if (a !== "neu" && bearbeiteId) { formLeeren(); }
        if (a === "liste") { zeichneListe(); }
        if (a === "export") { zeichneExport(); }
        if (a === "hilfe") { zeichneHilfe(); }
        window.scrollTo(0, 0);
    }

    function zaehlerAktualisieren() {
        var n = S.alle().length;
        var z = $("[data-zaehler]");
        z.hidden = n === 0;
        z.textContent = n === 1 ? "1 Eintrag offen" : n + " Einträge offen";
        var tz = $("[data-tab-zahl]");
        tz.hidden = n === 0;
        tz.textContent = n > 99 ? "99+" : String(n);
    }

    // ------------------------------------------------------------------ Formular

    var form = $("[data-formular]");
    var f = {
        name: $("#beschreibung"), datum: $("#datum"), betrag: $("#betrag"),
        kategorie: $("#kategorie"), gruppe: $("#gruppe"), steuer: $("#steuerrelevant")
    };
    var steuerKnopf = $('[data-schalter="steuerrelevant"]');
    var gruppeAutomatisch = false;

    function typWert() { var r = $('input[name="typ"]:checked', form); return r ? r.value : "Ausgabe"; }
    function rueckWert() { var r = $('input[name="rueckfluss"]:checked', form); return r ? r.value : ""; }

    function artAnzeigen() {
        var inv = typWert() === "Investment";
        $$("[data-rueckfluss]", form).forEach(function (x) { x.hidden = !inv; });
    }

    function setzeTyp(typ, rueckfluss) {
        var r = $('input[name="typ"][value="' + typ + '"]', form) || $("#typ-ausgabe");
        r.checked = true;
        (rueckfluss === "ja" ? $("#rueck-ja") : $("#rueck-nein")).checked = true;
        artAnzeigen();
    }

    function setzeSteuer(an) {
        f.steuer.checked = !!an;
        steuerKnopf.classList.toggle("ist-an", !!an);
        steuerKnopf.setAttribute("aria-checked", an ? "true" : "false");
    }

    function fehler(feld, text) {
        var span = $('[data-fehler="' + feld + '"]', form);
        var input = f[feld];
        span.textContent = text || "";
        span.hidden = !text;
        input.classList.toggle("ist-fehler", !!text);
        if (text) { input.setAttribute("aria-invalid", "true"); } else { input.removeAttribute("aria-invalid"); }
    }

    function vorschlaegeFuellen() {
        var v = S.vorschlaege();
        var kl = $("#kategorien-liste"), gl = $("#gruppen-liste");
        kl.innerHTML = ""; gl.innerHTML = "";
        v.kategorien.forEach(function (k) { var o = document.createElement("option"); o.value = k; kl.appendChild(o); });
        v.gruppen.forEach(function (g) { var o = document.createElement("option"); o.value = g; gl.appendChild(o); });
    }

    // Kategorie schon einmal mit Gruppe benutzt? -> Gruppe vorschlagen (änderbar)
    function kategorieGeaendert() {
        var kat = f.kategorie.value.trim();
        var zu = S.vorschlaege().zuordnung;
        var treffer = null;
        Object.keys(zu).forEach(function (k) {
            if (k.toLocaleLowerCase("de") === kat.toLocaleLowerCase("de")) { treffer = zu[k]; }
        });
        if (treffer && (!f.gruppe.value.trim() || gruppeAutomatisch)) {
            f.gruppe.value = treffer;
            gruppeAutomatisch = true;
        } else if (!treffer && gruppeAutomatisch) {
            f.gruppe.value = "";
            gruppeAutomatisch = false;
        }
    }

    function formLeeren(datumBehalten) {
        var d = datumBehalten ? f.datum.value : heute();
        form.reset();
        f.datum.value = d || heute();
        setzeTyp("Ausgabe", "");
        setzeSteuer(false);
        fehler("datum"); fehler("betrag");
        gruppeAutomatisch = false;
        bearbeiteId = null;
        $("[data-form-titel]").textContent = "Neuer Eintrag";
        $("[data-speichern-knopf]").textContent = "Hinzufügen";
        $("[data-abbrechen]").hidden = true;
    }

    function formFuellen(e) {
        f.name.value = e.beschreibung || "";
        f.datum.value = e.datum;
        setzeTyp(e.typ, e.rueckfluss);
        f.betrag.value = zahlFormat.format(e.betrag).replace(/\./g, "");
        f.kategorie.value = e.kategorie || "";
        f.gruppe.value = e.gruppe || "";
        setzeSteuer(e.steuerrelevant);
        gruppeAutomatisch = false;
        fehler("datum"); fehler("betrag");
    }

    function bearbeiten(id) {
        var e = S.holen(id);
        if (!e) { return; }
        location.hash = "#neu";
        // nach dem Wechsel der Ansicht (zeigeAnsicht leert sonst das Formular)
        setTimeout(function () {
            formFuellen(e);
            bearbeiteId = id;
            $("[data-form-titel]").textContent = "Eintrag bearbeiten";
            $("[data-speichern-knopf]").textContent = "Speichern";
            $("[data-abbrechen]").hidden = false;
        }, 0);
    }

    function formAbschicken(ereignis) {
        ereignis.preventDefault();
        var ok = true;
        var datum = f.datum.value;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) { fehler("datum", "Bitte ein Datum wählen."); ok = false; }
        else if (+datum.slice(0, 4) < 1900 || +datum.slice(0, 4) > 2100) { fehler("datum", "Das Datum muss zwischen 1900 und 2100 liegen."); ok = false; }
        else { fehler("datum"); }

        var betrag = leseBetrag(f.betrag.value);
        if (betrag === null) { fehler("betrag", "Bitte einen Betrag eingeben."); ok = false; }
        else if (isNaN(betrag)) { fehler("betrag", "Das ist keine Zahl – z. B. 49,99 eingeben."); ok = false; }
        else if (betrag <= 0) { fehler("betrag", "Der Betrag muss größer als 0 sein. Ob Einnahme oder Ausgabe, legt die Art fest."); ok = false; }
        else if (betrag >= 1e9) { fehler("betrag", "Der Betrag ist zu groß."); ok = false; }
        else { fehler("betrag"); }

        if (!ok) {
            var erstes = $(".ist-fehler", form);
            if (erstes) { erstes.focus(); }
            return;
        }

        var daten = {
            beschreibung: f.name.value, datum: datum, typ: typWert(), rueckfluss: rueckWert(),
            betrag: betrag, kategorie: f.kategorie.value, gruppe: f.gruppe.value, steuerrelevant: f.steuer.checked
        };
        var ergebnis;
        if (bearbeiteId) {
            ergebnis = S.aendern(bearbeiteId, daten);
            speicherFehler(ergebnis.gespeichert);
            formLeeren();
            vorschlaegeFuellen();
            zaehlerAktualisieren();
            location.hash = "#liste";
            toast("Änderung gespeichert ✓");
            return;
        }
        ergebnis = S.hinzufuegen(daten);
        speicherFehler(ergebnis.gespeichert);
        var e = ergebnis.eintrag;
        formLeeren(true);          // Datum bleibt stehen – praktisch bei mehreren Belegen vom selben Tag
        vorschlaegeFuellen();
        zaehlerAktualisieren();
        neuHinweis();
        window.scrollTo(0, 0);
        toast("Gespeichert ✓ " + (e.beschreibung || e.kategorie || e.typ) + " " + betragText(e), "Ansehen", function () {
            location.hash = "#liste";
        });
    }

    function neuHinweis() {
        var n = S.alle().length;
        $("[data-neu-hinweis]").textContent = n
            ? (n === 1 ? "1 Eintrag" : n + " Einträge") + " auf dem Handy, noch nicht exportiert."
            : "Die Einträge bleiben auf dem Handy, bis du sie unter „Export“ als Excel exportierst.";
    }

    // ------------------------------------------------------------------ Liste

    function summen(liste) {
        var s = { ein: 0, aus: 0, inv: 0 };
        liste.forEach(function (e) {
            if (e.typ === "Einnahme") { s.ein += e.betrag; }
            else if (e.typ === "Ausgabe") { s.aus += e.betrag; }
            else { s.inv += e.rueckfluss === "ja" ? -e.betrag : e.betrag; }
        });
        s.saldo = s.ein - s.aus - s.inv;
        return s;
    }

    function kennzahl(klasse, titel, wert) {
        var k = el("div", "kennzahl " + klasse);
        k.appendChild(el("span", "kennzahl-titel", titel));
        k.appendChild(el("span", "kennzahl-wert", wert));
        return k;
    }

    function zeichneKennzahlen(liste) {
        var box = $("[data-kennzahlen]");
        box.innerHTML = "";
        box.hidden = liste.length === 0;
        if (!liste.length) { return; }
        var s = summen(liste);
        var hatInv = liste.some(function (e) { return e.typ === "Investment"; });
        box.appendChild(kennzahl("ist-einnahmen", "Einnahmen", euro(s.ein)));
        box.appendChild(kennzahl("ist-ausgaben", "Ausgaben", euro(s.aus)));
        if (hatInv) { box.appendChild(kennzahl("ist-investiert", "Investiert", euro(s.inv))); }
        box.appendChild(kennzahl(s.saldo >= 0 ? "ist-plus" : "ist-minus", hatInv ? "Frei übrig" : "Saldo",
            (s.saldo > 0 ? "+" : "") + euro(s.saldo)));
    }

    function passtZurSuche(e, woerter) {
        if (!woerter.length) { return true; }
        var text = [e.beschreibung, e.kategorie, e.gruppe, datumText(e.datum), zahlFormat.format(e.betrag),
            X.artText(e), e.steuerrelevant ? "steuerrelevant" : ""].join(" ").toLocaleLowerCase("de");
        return woerter.every(function (w) { return text.indexOf(w) >= 0; });
    }

    function zeichneListe() {
        var alle = S.sortiert();
        var suche = $("[data-suche]");
        suche.hidden = alle.length < 8;
        var woerter = suche.hidden ? [] : suche.value.toLocaleLowerCase("de").split(/\s+/).filter(Boolean);
        var liste = alle.filter(function (e) { return passtZurSuche(e, woerter); });

        zeichneKennzahlen(alle);
        $("[data-liste-zusatz]").textContent = woerter.length
            ? liste.length + " von " + alle.length
            : (alle.length === 1 ? "1 Eintrag" : alle.length + " Einträge");
        $("[data-leer]").hidden = alle.length > 0;

        var ul = $("[data-liste]");
        ul.innerHTML = "";
        if (alle.length && !liste.length) {
            ul.appendChild(el("li", "handy-liste-nichts hinweis", "Nichts gefunden."));
        }
        liste.forEach(function (e) {
            var li = el("li", "handy-zeile");
            li.setAttribute("data-id", e.id);

            var links = el("div", "zeile-text");
            var oben = el("div", "zeile-oben");
            oben.appendChild(el("span", "zeile-datum", datumText(e.datum)));
            if (e.steuerrelevant) { oben.appendChild(el("span", "badge-steuer", "Steuer")); }
            links.appendChild(oben);
            links.appendChild(el("div", "zeile-name", e.beschreibung || (e.kategorie || "–")));
            var zusatz = [];
            if (e.beschreibung && e.kategorie) { zusatz.push(e.kategorie); }
            if (e.gruppe) { zusatz.push(e.gruppe); }
            if (zusatz.length) { links.appendChild(el("div", "zeile-zusatz leise", zusatz.join(" · "))); }

            var rechts = el("div", "zeile-rechts");
            var betrag = el("div", "zeile-betrag zahl " + farbKlasse(e), betragText(e));
            rechts.appendChild(betrag);
            if (e.typ === "Investment") {
                rechts.appendChild(el("span", "badge-invest", e.rueckfluss === "ja" ? "Geld zurück" : "Investment"));
            }
            var knoepfe = el("div", "zeile-knoepfe");
            var b = el("button", "icon-knopf", "✎");
            b.type = "button"; b.title = "Bearbeiten"; b.setAttribute("aria-label", "Eintrag bearbeiten");
            b.addEventListener("click", function () { bearbeiten(e.id); });
            var l = el("button", "icon-knopf ist-gefahr", "🗑");
            l.type = "button"; l.title = "Löschen"; l.setAttribute("aria-label", "Eintrag löschen");
            l.addEventListener("click", function () { eintragLoeschen(e); });
            knoepfe.appendChild(b); knoepfe.appendChild(l);
            rechts.appendChild(knoepfe);

            li.appendChild(links);
            li.appendChild(rechts);
            ul.appendChild(li);
        });
    }

    function eintragLoeschen(e) {
        if (!window.confirm("Diesen Eintrag löschen?\n\n" + datumText(e.datum) + " · " + (e.beschreibung || e.kategorie || e.typ) + " · " + betragText(e))) {
            return;
        }
        var weg = S.loeschen(e.id);
        zaehlerAktualisieren();
        zeichneListe();
        toast("Eintrag gelöscht.", "Rückgängig", function () {
            S.zurueckholen([weg]);
            zaehlerAktualisieren();
            zeichneListe();
            toast("Wiederhergestellt ✓");
        });
    }

    // ------------------------------------------------------------------ Export

    var testDatei = null;
    function kannTeilen() {
        try {
            if (!navigator.canShare || !window.File) { return false; }
            testDatei = testDatei || new File([new Uint8Array([80, 75])], "test.xlsx", { type: X.MIME });
            return navigator.canShare({ files: [testDatei] });
        } catch (e) {
            return false;
        }
    }

    function dateiName(jetzt) {
        var p = function (n) { return String(n).padStart(2, "0"); };
        return "Finanzapp-Handy_" + jetzt.getFullYear() + "-" + p(jetzt.getMonth() + 1) + "-" + p(jetzt.getDate()) +
            "_" + p(jetzt.getHours()) + "-" + p(jetzt.getMinutes()) + ".xlsx";
    }

    function herunterladen(bytes, name) {
        var blob = new Blob([bytes], { type: X.MIME });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 30000);
    }

    /** Gibt ein Promise zurück: "ok" | "abgebrochen" */
    function ausgeben(bytes, name, weg) {
        if (weg === "teilen" && kannTeilen()) {
            var datei = new File([bytes], name, { type: X.MIME });
            return navigator.share({ files: [datei], title: name }).then(function () { return "ok"; }, function (fehlerObj) {
                if (fehlerObj && fehlerObj.name === "AbortError") { return "abgebrochen"; }
                herunterladen(bytes, name);     // Teilen nicht möglich -> normal herunterladen
                return "ok";
            });
        }
        herunterladen(bytes, name);
        return Promise.resolve("ok");
    }

    var exportLaeuft = false;
    function exportieren(weg) {
        if (exportLaeuft) { return; }
        var eintraege = S.alle();
        if (!eintraege.length) { return; }
        exportLaeuft = true;
        var jetzt = new Date();
        var name = dateiName(jetzt);
        var bytes;
        try {
            bytes = X.erstelle(eintraege, jetzt);
        } catch (e) {
            exportLaeuft = false;
            toast("Die Excel-Datei konnte nicht erstellt werden: " + e.message, null, null, 8000);
            return;
        }
        ausgeben(bytes, name, weg).then(function (ergebnis) {
            exportLaeuft = false;
            if (ergebnis === "abgebrochen") {
                toast("Abgebrochen – die Einträge bleiben auf dem Handy.");
                return;
            }
            var x = S.exportAbschliessen(eintraege, name);
            zaehlerAktualisieren();
            zeichneExport();
            toast(eintraege.length + (eintraege.length === 1 ? " Eintrag" : " Einträge") + " exportiert und vom Handy entfernt.",
                "Rückgängig", function () {
                    S.exportZurueckholen(x.id);
                    zaehlerAktualisieren();
                    zeichneExport();
                    toast("Die Einträge sind wieder in der Liste.");
                }, 9000);
        });
    }

    function zeitText(ms) {
        var d = new Date(ms);
        var p = function (n) { return String(n).padStart(2, "0"); };
        return p(d.getDate()) + "." + p(d.getMonth() + 1) + "." + d.getFullYear() + ", " + p(d.getHours()) + ":" + p(d.getMinutes()) + " Uhr";
    }

    function zeichneExport() {
        var n = S.alle().length;
        var teilen = kannTeilen();
        $("[data-export-text]").textContent = n
            ? (n === 1 ? "1 Eintrag wird" : n + " Einträge werden") + " in eine Excel-Datei geschrieben und danach vom Handy entfernt."
            : "Zurzeit gibt es nichts zu exportieren – alle Einträge sind schon exportiert.";
        var tKnopf = $('[data-export="teilen"]');
        var lKnopf = $('[data-export="laden"]');
        tKnopf.hidden = !teilen;
        tKnopf.disabled = !n;
        lKnopf.disabled = !n;
        lKnopf.classList.toggle("btn-grau", teilen);
        $("[data-export-hinweis]").textContent = teilen
            ? "„Senden / speichern“ öffnet das Teilen-Menü (z. B. „In Dateien sichern“, Mail). „Herunterladen“ legt die Datei in „Downloads“ ab."
            : "Die Datei landet im Ordner „Downloads“ des Handys.";

        var liste = S.exporte();
        $("[data-exporte-karte]").hidden = liste.length === 0;
        var ul = $("[data-exporte]");
        ul.innerHTML = "";
        liste.forEach(function (x) {
            var li = el("li", "export-zeile");
            var text = el("div", "export-zeile-text");
            text.appendChild(el("div", "export-zeit", zeitText(x.zeit)));
            var anzahl = (x.eintraege || []).length;
            var s = summen(x.eintraege || []);
            text.appendChild(el("div", "leise", (anzahl === 1 ? "1 Eintrag" : anzahl + " Einträge") +
                " · Ausgaben " + euro(s.aus) + (s.ein ? " · Einnahmen " + euro(s.ein) : "")));
            var knoepfe = el("div", "export-knoepfe");
            var nochmal = el("button", "btn-knopf btn-grau btn-klein", "Nochmal speichern");
            nochmal.type = "button";
            nochmal.addEventListener("click", function () {
                var bytes = X.erstelle(x.eintraege || [], new Date(x.zeit));
                ausgeben(bytes, x.datei, teilen ? "teilen" : "laden");
            });
            var zurueck = el("button", "btn-knopf btn-grau btn-klein", "Zurückholen");
            zurueck.type = "button";
            zurueck.addEventListener("click", function () {
                if (!window.confirm("Die " + anzahl + " Einträge dieses Exports wieder in die Liste holen?\n\n" +
                    "Nur sinnvoll, wenn die Datei NICHT in die WebApp eingelesen wurde.")) { return; }
                var neu = S.exportZurueckholen(x.id);
                zaehlerAktualisieren();
                zeichneExport();
                toast(neu + (neu === 1 ? " Eintrag ist" : " Einträge sind") + " wieder in der Liste.");
            });
            knoepfe.appendChild(nochmal);
            knoepfe.appendChild(zurueck);
            li.appendChild(text);
            li.appendChild(knoepfe);
            ul.appendChild(li);
        });
    }

    // ------------------------------------------------------------------ Hilfe

    function zeichneHilfe() {
        var v = S.vorschlaege();
        var n = v.kategorien.length + v.gruppen.length;
        $("[data-vorschlaege-text]").textContent = n
            ? "Gemerkt: " + v.kategorien.length + " Kategorien und " + v.gruppen.length + " Gruppen. Sie werden beim Tippen vorgeschlagen und bleiben auch nach dem Export erhalten."
            : "Noch keine Vorschläge gemerkt. Benutzte Kategorien und Gruppen werden beim Tippen vorgeschlagen.";
        $("[data-vorschlaege-loeschen]").disabled = n === 0;
    }

    // ------------------------------------------------------------------ Installieren & Updates

    var installEreignis = null;

    function istInstalliert() {
        return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
    }

    function istIOS() {
        return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
            (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    }

    function installHinweis() {
        var box = $("[data-installieren]");
        if (istInstalliert() || S.merker("installHinweisZu")) { box.hidden = true; return; }
        var text = $("[data-installieren-text]");
        var knopf = $("[data-installieren-knopf]");
        if (installEreignis) {
            text.textContent = "Dann startet sie wie eine normale App und funktioniert auch ohne Internet.";
            knopf.hidden = false;
        } else if (istIOS()) {
            text.textContent = "In Safari: Teilen-Symbol (bzw. „…“ → „Teilen“) → „Zum Home-Bildschirm“ → „Hinzufügen“. Danach nur noch über das Symbol öffnen.";
            knopf.hidden = true;
        } else {
            text.textContent = "Im Browser-Menü ⋮ → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.";
            knopf.hidden = true;
        }
        box.hidden = false;
    }

    window.addEventListener("beforeinstallprompt", function (e) {
        e.preventDefault();
        installEreignis = e;
        installHinweis();
    });
    window.addEventListener("appinstalled", function () {
        installEreignis = null;
        $("[data-installieren]").hidden = true;
    });

    function serviceWorker() {
        if (!("serviceWorker" in navigator)) { return; }
        var neuLaden = false;
        // Beim allerersten Öffnen übernimmt der Service Worker die Seite ebenfalls -
        // dann NICHT neu laden, nur nach einem echten Update.
        var hatteController = !!navigator.serviceWorker.controller;
        navigator.serviceWorker.addEventListener("controllerchange", function () {
            if (!hatteController) { hatteController = true; return; }
            if (neuLaden) { return; }
            neuLaden = true;
            location.reload();
        });
        navigator.serviceWorker.register("sw.js").then(function (reg) {
            function wartet(w) {
                if (!w || !navigator.serviceWorker.controller) { return; }
                var box = $("[data-update]");
                box.hidden = false;
                $("[data-update-knopf]").onclick = function () { w.postMessage({ typ: "aktivieren" }); };
            }
            if (reg.waiting) { wartet(reg.waiting); }
            reg.addEventListener("updatefound", function () {
                var neu = reg.installing;
                if (!neu) { return; }
                neu.addEventListener("statechange", function () {
                    if (neu.state === "installed") { wartet(neu); }
                });
            });
            document.addEventListener("visibilitychange", function () {
                if (document.visibilityState === "visible") { reg.update().catch(function () {}); }
            });
        }).catch(function () { /* z. B. ohne HTTPS – App funktioniert trotzdem, nur nicht offline */ });
    }

    // ------------------------------------------------------------------ Start

    function start() {
        if (!S.verfuegbar) { $("[data-speicher-warnung]").hidden = false; }
        if (navigator.storage && navigator.storage.persist) {
            navigator.storage.persist().catch(function () {});
        }

        formLeeren();
        vorschlaegeFuellen();
        zaehlerAktualisieren();
        neuHinweis();

        form.addEventListener("submit", formAbschicken);
        $$('input[name="typ"]', form).forEach(function (r) { r.addEventListener("change", artAnzeigen); });
        steuerKnopf.addEventListener("click", function () { setzeSteuer(!f.steuer.checked); });
        f.kategorie.addEventListener("input", kategorieGeaendert);
        f.kategorie.addEventListener("change", kategorieGeaendert);
        f.gruppe.addEventListener("input", function () { gruppeAutomatisch = false; });
        f.betrag.addEventListener("input", function () { if (f.betrag.classList.contains("ist-fehler")) { fehler("betrag"); } });
        f.datum.addEventListener("change", function () { fehler("datum"); });
        $("[data-abbrechen]").addEventListener("click", function () {
            formLeeren();
            location.hash = "#liste";
        });

        $("[data-suche]").addEventListener("input", zeichneListe);
        $$("[data-export]").forEach(function (b) {
            b.addEventListener("click", function () { exportieren(b.getAttribute("data-export")); });
        });
        $("[data-vorschlaege-loeschen]").addEventListener("click", function () {
            if (!window.confirm("Alle gemerkten Kategorien und Gruppen vergessen? Deine Einträge bleiben erhalten.")) { return; }
            S.vorschlaegeLoeschen();
            vorschlaegeFuellen();
            zeichneHilfe();
            toast("Vorschläge gelöscht.");
        });
        $("[data-installieren-knopf]").addEventListener("click", function () {
            if (!installEreignis) { return; }
            installEreignis.prompt();
            installEreignis.userChoice.then(function () { installEreignis = null; installHinweis(); }, function () {});
        });
        $("[data-installieren-zu]").addEventListener("click", function () {
            S.merker("installHinweisZu", true);
            $("[data-installieren]").hidden = true;
        });

        window.addEventListener("hashchange", zeigeAnsicht);
        // Datum auf "heute" nachziehen, wenn die App über Nacht offen war
        document.addEventListener("visibilitychange", function () {
            if (document.visibilityState === "visible" && !bearbeiteId && !f.betrag.value && !f.name.value) {
                f.datum.value = heute();
            }
            zaehlerAktualisieren();
        });
        zeigeAnsicht();
        installHinweis();
        serviceWorker();
    }

    start();

    // für Tests
    window.FAhandy = { leseBetrag: leseBetrag, summen: summen, dateiName: dateiName };
})();
