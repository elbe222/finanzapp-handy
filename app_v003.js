/*
 * app_v003.js – Finanzapp Handy, Version 3
 *
 * v3: Kategorie als Textfeld (neue Kategorie einfach eintippen); darunter die 5 zuletzt benutzten
 *     Kategorien, beim Tippen stattdessen die passenden. Mehrere Codes vom PC werden eingesammelt,
 *     während der PC sie von selbst wechselt (ab Finanz-App 21).
 *
 * H1  Einträge erfassen – v2: Betrag zuerst (großes Feld), die 5 zuletzt benutzten Kategorien zum
 *     Antippen, alle anderen in „Alle Kategorien …“ (nach Gruppen, mit Suche, neue erlaubt);
 *     Datum per „heute / gestern / anderes Datum …“. Kommt die Kategorie vom PC, steht die
 *     Kategoriegruppe fest (wie am PC).
 * H2  Liste der Einträge auf dem Handy mit Summen, Suche, Bearbeiten, Löschen (+ Rückgängig)
 * H3  Excel-Export im Format der Importvorlage der Finanz-App; danach verschwinden die Einträge
 *     vom Handy (die letzten 5 Exporte bleiben zum Nachspeichern/Zurückholen)
 * H4  Anleitung, Installations-Hinweis, Update-Hinweis, offline nutzbar
 * H5  (v2) Kategorien, Kategoriegruppen und Aussehen per QR-Code vom PC (scanner_v001.js)
 * H6  (v2) Aussehen wie am PC: Hell/Dunkel, Farbschema, Zahlenfarben (farben_v001.js)
 * H7  (v2) Erinnerung „noch nicht am PC“: blau, nach x Tagen (Standard 14) orange – ohne Internet
 *
 * Benötigt: farben_v001.js, speicher_v002.js (FAspeicher), xlsx_v001.js (FAxlsx), scanner_v001.js
 */
(function () {
    "use strict";

    var S = window.FAspeicher;
    var X = window.FAxlsx;
    var $ = function (sel, wurzel) { return (wurzel || document).querySelector(sel); };
    var $$ = function (sel, wurzel) { return Array.prototype.slice.call((wurzel || document).querySelectorAll(sel)); };
    var ANZAHL_ZULETZT = 5;
    var TAG_MS = 86400000;

    // ------------------------------------------------------------------ Formatierung (wie Finanz-App)

    var zahlFormat = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    function euro(wert) {
        var text = zahlFormat.format(Math.abs(wert));
        return (wert < 0 && text !== "0,00" ? "−" : "") + text + " €";
    }

    function datumText(iso) {
        var t = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
        return t ? t[3] + "." + t[2] + "." + t[1] : (iso || "");
    }

    function isoVon(d) {
        return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }
    function heute() { return isoVon(new Date()); }
    function gestern() { var d = new Date(); d.setDate(d.getDate() - 1); return isoVon(d); }
    function kurzDatum(ms) { var d = new Date(ms); return String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0") + "."; }

    function istRein(e) { return e.typ === "Einnahme" || (e.typ === "Investment" && e.rueckfluss === "ja"); }

    function farbKlasse(e) {
        if (e.typ === "Investment") { return "investiert"; }
        return e.typ === "Einnahme" ? "einnahmen" : "ausgaben";
    }

    function betragText(e) { return (istRein(e) ? "+" : "−") + euro(e.betrag); }

    /** "1.234,56" / "49,99" / "49.99" / "12 €" -> Zahl oder null (gleiche Regeln wie der Import der Finanz-App) */
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

    function mehrzahl(n, eins, viele) { return n + " " + (n === 1 ? eins : viele); }
    function klein(t) { return String(t || "").toLocaleLowerCase("de"); }

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
        clearTimeout(toastZeit);
        toastZeit = setTimeout(function () { t.hidden = true; }, dauer || (aktion ? 7000 : 3500));
    }

    function speicherFehler(ok) {
        if (ok === false && S.verfuegbar) {
            toast("Achtung: Der Speicher des Handys ist voll – bitte jetzt exportieren.", null, null, 8000);
        }
    }

    // ------------------------------------------------------------------ Ansichten (#neu, #liste, #export, #mehr, #scan)

    var ANSICHTEN = ["neu", "liste", "export", "mehr", "scan"];
    var TAB_JE_ANSICHT = { scan: "mehr" };
    var bearbeiteId = null;

    function aktuelleAnsicht() {
        var h = (location.hash || "").replace("#", "");
        if (h === "hilfe") { return "mehr"; }                  // alte Adresse (Version 1)
        return ANSICHTEN.indexOf(h) >= 0 ? h : "neu";
    }

    function zeigeAnsicht() {
        var a = aktuelleAnsicht();
        var tab = TAB_JE_ANSICHT[a] || a;
        blattZu();
        $$("[data-ansicht]").forEach(function (s) { s.hidden = s.getAttribute("data-ansicht") !== a; });
        $$("[data-tab]").forEach(function (t) {
            var an = t.getAttribute("data-tab") === tab;
            t.classList.toggle("ist-aktiv", an);
            if (an) { t.setAttribute("aria-current", "page"); } else { t.removeAttribute("aria-current"); }
        });
        if (a !== "neu" && bearbeiteId) { formLeeren(); }
        if (a !== "scan") { scanStoppen(); }
        if (a === "neu") { pcHinweis(); }
        if (a === "liste") { zeichneListe(); }
        if (a === "export") { zeichneExport(); }
        if (a === "mehr") { zeichneMehr(); }
        if (a === "scan") { scanStarten(); }
        erinnerung();
        window.scrollTo(0, 0);
    }

    function zaehlerAktualisieren() {
        var n = S.alle().length;
        var z = $("[data-zaehler]");
        z.hidden = n === 0;
        z.textContent = n + " nicht am PC";
        var tz = $("[data-tab-zahl]");
        tz.hidden = n === 0;
        tz.textContent = n > 99 ? "99+" : String(n);
    }

    // ------------------------------------------------------------------ H7 Erinnerung „noch nicht am PC“

    function erinnerungTage() {
        var t = S.merker("erinnerungTage");
        return t == null ? 14 : Number(t);
    }

    function erinnerungsInfo() {
        var liste = S.alle();
        if (!liste.length) { return null; }
        var aeltest = Math.min.apply(null, liste.map(function (e) { return e.erstellt || Date.now(); }));
        var tage = Math.floor((Date.now() - aeltest) / TAG_MS);
        var grenze = erinnerungTage();
        var letzter = S.merker("letzterExport") || (S.exporte()[0] || {}).zeit || null;
        return { anzahl: liste.length, aeltest: aeltest, tage: tage, faellig: grenze > 0 && tage >= grenze, letzter: letzter };
    }

    function erinnerung() {
        var info = erinnerungsInfo();
        var ansicht = aktuelleAnsicht();
        $$("[data-erinnerung]").forEach(function (box) {
            var ort = box.getAttribute("data-erinnerung");
            // Auf „Neu“ nur, wenn es Zeit wird – sonst würde der Hinweis beim Eintragen stören
            var zeigen = info && ort === ansicht && (ort !== "neu" || info.faellig);
            box.hidden = !zeigen;
            if (!zeigen) { return; }
            box.innerHTML = "";
            box.classList.toggle("ist-faellig", info.faellig);
            var text = el("div");
            if (info.faellig) {
                text.appendChild(el("strong", null, mehrzahl(info.anzahl, "Eintrag", "Einträge") + " seit " +
                    mehrzahl(info.tage, "Tag", "Tagen") + " nicht am PC"));
                text.appendChild(el("span", "banner-text", "Bitte bald exportieren – sie liegen nur auf diesem Handy."));
            } else {
                text.appendChild(el("strong", null, mehrzahl(info.anzahl, "Eintrag", "Einträge") + " noch nicht am PC"));
                var seit = info.letzter ? Math.floor((Date.now() - info.letzter) / TAG_MS) : null;
                text.appendChild(el("span", "banner-text", "ältester vom " + kurzDatum(info.aeltest) + " · " +
                    (seit === null ? "noch nie exportiert" : seit === 0 ? "letzter Export heute" : "letzter Export vor " + mehrzahl(seit, "Tag", "Tagen"))));
            }
            box.appendChild(text);
            if (ort !== "export") {
                var a = el("a", "btn-knopf btn-klein", "Exportieren");
                a.href = "#export";
                box.appendChild(a);
            }
        });
    }

    // ------------------------------------------------------------------ Formular

    var form = $("[data-formular]");
    var f = {
        name: $("#beschreibung"), datum: $("#datum"), betrag: $("#betrag"),
        kategorie: $("#kategorie"), gruppe: $("#gruppe"), steuer: $("#steuerrelevant")
    };
    var steuerKnopf = $('[data-schalter="steuerrelevant"]');

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

    // ---------------- Kategorie: Knöpfe + Gruppe

    function gruppenFuellen() {
        var gl = $("#gruppen-liste");
        gl.innerHTML = "";
        S.alleGruppen().forEach(function (g) { var o = document.createElement("option"); o.value = g; gl.appendChild(o); });
    }

    var ANZAHL_TREFFER = 6;
    var tippModus = false;      // true, solange im Kategorie-Feld getippt wird: Knöpfe zeigen passende Kategorien
    var gruppeFest = false;     // zuletzt kam die Gruppe fest vom PC

    /** Vorhandene Kategorien, die zum getippten Text passen: erst die, die so anfangen, dann Wortanfänge, dann der Rest. */
    function passendeKategorien(text) {
        var w = klein(text.trim());
        if (!w) { return []; }
        var liste = [];
        S.alleKategorien().forEach(function (k) {
            var n = klein(k.name), pos = n.indexOf(w);
            if (pos < 0) { return; }
            var rang = pos === 0 ? 0 : (/[\s\-\/&(]/.test(n.charAt(pos - 1)) ? 1 : 2);
            liste.push({ name: k.name, rang: rang, pos: pos });
        });
        liste.sort(function (a, b) { return a.rang - b.rang || a.name.localeCompare(b.name, "de", { sensitivity: "base" }); });
        return liste;
    }

    function katKnopf(name, an, treffer) {
        var k = el("button", "chip" + (an ? " ist-an" : ""));
        k.type = "button";
        if (treffer) {
            var pos = klein(name).indexOf(klein(treffer));
            k.appendChild(document.createTextNode(name.slice(0, pos)));
            k.appendChild(el("b", "treffer", name.slice(pos, pos + treffer.length)));
            k.appendChild(document.createTextNode(name.slice(pos + treffer.length)));
        } else {
            k.textContent = name;
        }
        k.setAttribute("aria-pressed", an ? "true" : "false");
        // pointerdown verhindert, dass das Feld vorher den Fokus verliert und die Tastatur springt
        k.addEventListener("mousedown", function (e) { e.preventDefault(); });
        k.addEventListener("click", function () {
            waehleKategorie(an && !tippModus ? "" : name);
            if (document.activeElement === f.kategorie) { f.kategorie.blur(); }
        });
        return k;
    }

    function zeichneKategorieKnoepfe() {
        var box = $("[data-kat-chips]"), unter = $("[data-kat-unter]");
        box.innerHTML = "";
        var text = f.kategorie.value.trim();
        var namen, label = "", treffer = null;
        if (tippModus && text) {
            var passend = passendeKategorien(text);
            namen = passend.slice(0, ANZAHL_TREFFER).map(function (x) { return x.name; });
            label = passend.length ? (passend.length > ANZAHL_TREFFER ? "Passende Kategorien (" + passend.length + ")" : "Passende Kategorien") : "";
            treffer = text;
        } else {
            namen = S.zuletzt(ANZAHL_ZULETZT);
            if (text && !namen.some(function (n) { return klein(n) === klein(text); })) { namen = [text].concat(namen); }
            label = namen.length ? "Zuletzt benutzt" : "";
        }
        unter.textContent = label;
        unter.hidden = !label;
        namen.forEach(function (name) {
            var an = !!text && klein(name) === klein(text);
            box.appendChild(katKnopf(name, an, treffer && klein(name).indexOf(klein(treffer)) >= 0 ? treffer : null));
        });
        var alle = el("button", "chip mehr", S.alleKategorien().length > namen.length ? "Alle Kategorien …" : "Kategorie wählen …");
        alle.type = "button";
        alle.setAttribute("data-alle-kategorien", "");
        alle.addEventListener("mousedown", function (e) { e.preventDefault(); });
        alle.addEventListener("click", blattAuf);
        box.appendChild(alle);
        $("[data-kat-leeren]").hidden = !f.kategorie.value;
    }

    /**
     * Zeigt, welche Gruppe gilt: vom PC fest, sonst (neue / nur auf dem Handy benutzte Kategorie) frei wählbar.
     * gruppeVorgabe: Gruppe zum Vorbelegen (z. B. beim Bearbeiten); undefined beim Tippen = eingetippte Gruppe behalten.
     */
    function gruppeAnzeigen(gruppeVorgabe) {
        var kat = f.kategorie.value.trim();
        var info = $("[data-gruppe-info]"), zeile = $("[data-gruppe-zeile]");
        info.innerHTML = "";
        if (!kat) {
            info.hidden = true; zeile.hidden = true; f.gruppe.value = ""; gruppeFest = false;
            return;
        }
        var k = S.kategorieInfo(kat);
        if (k && k.quelle === "pc") {
            zeile.hidden = true;
            f.gruppe.value = k.gruppe;
            gruppeFest = true;
            if (k.gruppe) {
                info.appendChild(document.createTextNode("Kategoriegruppe: "));
                info.appendChild(el("b", null, k.gruppe));
                info.appendChild(document.createTextNode(" (vom PC)"));
            } else {
                info.textContent = "Ohne Kategoriegruppe (wie am PC)";
            }
            info.hidden = false;
            return;
        }
        var behalten = gruppeVorgabe === undefined && !gruppeFest && !zeile.hidden;   // beim Tippen nichts wegwerfen
        zeile.hidden = false;
        if (gruppeFest) { f.gruppe.value = ""; }
        gruppeFest = false;
        if (k) {
            info.hidden = true;
            if (!behalten || !f.gruppe.value) { f.gruppe.value = gruppeVorgabe != null ? gruppeVorgabe : k.gruppe; }
        } else {
            info.hidden = false;
            info.textContent = tippModus && passendeKategorien(kat).length
                ? "Neue Kategorie „" + kat + "“ – sie wird beim Einlesen am PC angelegt. Oder eine passende antippen."
                : "Neue Kategorie – sie wird beim Einlesen am PC angelegt.";
            if (!behalten) { f.gruppe.value = gruppeVorgabe != null ? gruppeVorgabe : ""; }
        }
    }

    /** Kategorie festlegen (Knopf, Auswahlblatt, Bearbeiten): Feld füllen, Schreibweise wie am PC. */
    function waehleKategorie(name, gruppeVorgabe) {
        name = String(name || "").trim();
        var k = name ? S.kategorieInfo(name) : null;
        tippModus = false;
        f.kategorie.value = k ? k.name : name;       // Schreibweise wie am PC
        zeichneKategorieKnoepfe();
        gruppeAnzeigen(gruppeVorgabe === undefined ? null : gruppeVorgabe);
    }

    /** Beim Tippen im Kategorie-Feld. */
    function kategorieGetippt() {
        tippModus = true;
        zeichneKategorieKnoepfe();
        gruppeAnzeigen(undefined);
    }

    /** Feld verlassen: Schreibweise einer vorhandenen Kategorie übernehmen (lebensmittel → Lebensmittel). */
    function kategorieFertig() {
        var text = f.kategorie.value.trim();
        var k = text ? S.kategorieInfo(text) : null;
        if (k && k.name !== f.kategorie.value) { f.kategorie.value = k.name; }
        else if (text !== f.kategorie.value) { f.kategorie.value = text; }
        gruppeAnzeigen(undefined);
    }

    // ---------------- Auswahlblatt „Alle Kategorien …“

    function blattAuf() {
        $("[data-blatt]").hidden = false;
        document.body.classList.add("blatt-offen");
        var suche = $("[data-blatt-suche]");
        suche.value = tippModus ? f.kategorie.value.trim() : "";
        zeichneBlatt();
        setTimeout(function () { $(".blatt").scrollTop = 0; }, 0);
    }

    function blattZu() {
        var b = $("[data-blatt]");
        if (!b || b.hidden) { return; }
        b.hidden = true;
        document.body.classList.remove("blatt-offen");
    }

    function blattWahl(name) {
        waehleKategorie(name);
        blattZu();
    }

    function chip(name, an, zusatz) {
        var k = el("button", "chip" + (an ? " ist-an" : ""));
        k.type = "button";
        k.appendChild(document.createTextNode(name));
        if (zusatz) { k.appendChild(el("small", null, zusatz)); }
        k.addEventListener("click", function () { blattWahl(name); });
        return k;
    }

    function zeichneBlatt() {
        var box = $("[data-blatt-liste]");
        box.innerHTML = "";
        var such = $("[data-blatt-suche]").value.trim();
        var alle = S.alleKategorien();
        var gewaehlt = klein(f.kategorie.value);
        var namen = alle.map(function (k) { return k.name; });

        if (such) {
            var w = klein(such);
            var treffer = alle.filter(function (k) { return klein(k.name).indexOf(w) >= 0 || klein(k.gruppe).indexOf(w) >= 0; });
            var reihe = el("div", "chips");
            treffer.slice(0, 60).forEach(function (k) { reihe.appendChild(chip(k.name, klein(k.name) === gewaehlt, k.gruppe)); });
            var exakt = namen.some(function (n) { return klein(n) === w; });
            if (!exakt) {
                var neu = el("button", "chip mehr", "„" + such + "“ als neue Kategorie");
                neu.type = "button";
                neu.setAttribute("data-neue-kategorie", "");
                neu.addEventListener("click", function () { blattWahl(such); });
                reihe.appendChild(neu);
            }
            if (!treffer.length && exakt) { reihe.appendChild(el("p", "blatt-leer", "Nichts gefunden.")); }
            box.appendChild(reihe);
            return;
        }

        if (!alle.length) {
            box.appendChild(el("p", "blatt-leer", "Noch keine Kategorien. Oben eine neue eintippen – oder unter „Mehr“ die Kategorien vom PC übernehmen."));
        }
        var zuletzt = S.zuletzt(ANZAHL_ZULETZT);
        if (zuletzt.length) {
            box.appendChild(el("div", "grp-titel", "Zuletzt benutzt"));
            var r1 = el("div", "chips");
            zuletzt.forEach(function (n) { r1.appendChild(chip(n, klein(n) === gewaehlt)); });
            box.appendChild(r1);
        }
        // nach Kategoriegruppen, „Ohne Kategoriegruppe“ zuletzt
        var je = {};
        alle.forEach(function (k) { (je[k.gruppe || ""] = je[k.gruppe || ""] || []).push(k.name); });
        var gruppen = Object.keys(je).filter(Boolean).sort(function (a, b) { return a.localeCompare(b, "de"); });
        if (je[""]) { gruppen.push(""); }
        gruppen.forEach(function (g) {
            box.appendChild(el("div", "grp-titel", g || "Ohne Kategoriegruppe"));
            var reihe = el("div", "chips");
            je[g].sort(function (a, b) { return a.localeCompare(b, "de"); })
                .forEach(function (n) { reihe.appendChild(chip(n, klein(n) === gewaehlt)); });
            box.appendChild(reihe);
        });
        var ende = el("div", "chips abstand-oben");
        var ohne = el("button", "chip mehr", "ohne Kategorie");
        ohne.type = "button";
        ohne.addEventListener("click", function () { blattWahl(""); });
        ende.appendChild(ohne);
        box.appendChild(ende);
    }

    // ---------------- Datum: heute / gestern / anderes Datum

    function datumAnzeigen() {
        var wert = f.datum.value;
        var art = wert === heute() ? "heute" : wert === gestern() ? "gestern" : "anderes";
        var zeile = $("[data-datum-zeile]");
        $$("[data-datum-wahl]").forEach(function (k) {
            var an = k.getAttribute("data-datum-wahl") === art;
            k.classList.toggle("ist-an", an);
            k.setAttribute("aria-pressed", an ? "true" : "false");
            if (k.getAttribute("data-datum-wahl") === "anderes") {
                k.textContent = art === "anderes" && wert ? datumText(wert) : "anderes Datum …";
            }
        });
        if (art !== "anderes" && !zeile.dataset.festOffen) { zeile.hidden = true; }
        if (art === "anderes") { zeile.hidden = false; }
    }

    function datumWahl(art) {
        var zeile = $("[data-datum-zeile]");
        if (art === "heute") { f.datum.value = heute(); delete zeile.dataset.festOffen; }
        else if (art === "gestern") { f.datum.value = gestern(); delete zeile.dataset.festOffen; }
        else {
            zeile.hidden = false;
            zeile.dataset.festOffen = "1";
            try { if (f.datum.showPicker) { f.datum.showPicker(); } else { f.datum.focus(); } } catch (e) { f.datum.focus(); }
        }
        fehler("datum");
        datumAnzeigen();
    }

    // ---------------- Formular leeren / füllen / speichern

    function formLeeren(datumBehalten) {
        var d = datumBehalten ? f.datum.value : heute();
        form.reset();
        f.datum.value = d || heute();
        delete $("[data-datum-zeile]").dataset.festOffen;
        setzeTyp("Ausgabe", "");
        setzeSteuer(false);
        fehler("datum"); fehler("betrag");
        bearbeiteId = null;
        f.kategorie.value = "";
        $("[data-form-titel]").textContent = "Neuer Eintrag";
        $("[data-speichern-knopf]").textContent = "Hinzufügen";
        $("[data-abbrechen]").hidden = true;
        waehleKategorie("");
        datumAnzeigen();
    }

    function formFuellen(e) {
        f.name.value = e.beschreibung || "";
        f.datum.value = e.datum;
        setzeTyp(e.typ, e.rueckfluss);
        f.betrag.value = zahlFormat.format(e.betrag).replace(/\./g, "");
        setzeSteuer(e.steuerrelevant);
        fehler("datum"); fehler("betrag");
        waehleKategorie(e.kategorie || "", e.gruppe || "");
        datumAnzeigen();
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
        if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) { fehler("datum", "Bitte ein Datum wählen."); ok = false; $("[data-datum-zeile]").hidden = false; }
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
            betrag: betrag, kategorie: f.kategorie.value.trim(), gruppe: f.kategorie.value.trim() ? f.gruppe.value : "",
            steuerrelevant: f.steuer.checked
        };
        var ergebnis;
        if (bearbeiteId) {
            ergebnis = S.aendern(bearbeiteId, daten);
            speicherFehler(ergebnis.gespeichert);
            formLeeren();
            gruppenFuellen();
            zaehlerAktualisieren();
            location.hash = "#liste";
            toast("Änderung gespeichert ✓");
            return;
        }
        ergebnis = S.hinzufuegen(daten);
        speicherFehler(ergebnis.gespeichert);
        var e = ergebnis.eintrag;
        formLeeren(true);          // Datum bleibt stehen – praktisch bei mehreren Belegen vom selben Tag
        gruppenFuellen();
        zaehlerAktualisieren();
        neuHinweis();
        erinnerung();
        if (document.activeElement && document.activeElement.blur) { document.activeElement.blur(); }
        window.scrollTo(0, 0);
        toast("Gespeichert ✓ " + (e.beschreibung || e.kategorie || e.typ) + " " + betragText(e), "Ansehen", function () {
            location.hash = "#liste";
        });
    }

    function neuHinweis() {
        var n = S.alle().length;
        $("[data-neu-hinweis]").textContent = n
            ? mehrzahl(n, "Eintrag", "Einträge") + " auf dem Handy, noch nicht exportiert."
            : "Die Einträge bleiben auf dem Handy, bis du sie unter „Export“ als Excel exportierst.";
    }

    function pcHinweis() {
        $("[data-pc-hinweis]").hidden = !!S.pc() || !!S.merker("pcHinweisZu");
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
        $("[data-liste-zusatz]").textContent = woerter.length ? liste.length + " von " + alle.length : mehrzahl(alle.length, "Eintrag", "Einträge");
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
            rechts.appendChild(el("div", "zeile-betrag zahl " + farbKlasse(e), betragText(e)));
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
        erinnerung();
        toast("Eintrag gelöscht.", "Rückgängig", function () {
            S.zurueckholen([weg]);
            zaehlerAktualisieren();
            zeichneListe();
            erinnerung();
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
            erinnerung();
            toast(mehrzahl(eintraege.length, "Eintrag", "Einträge") + " exportiert und vom Handy entfernt.",
                "Rückgängig", function () {
                    S.exportZurueckholen(x.id);
                    zaehlerAktualisieren();
                    zeichneExport();
                    erinnerung();
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
            text.appendChild(el("div", "leise", mehrzahl(anzahl, "Eintrag", "Einträge") +
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
                    "Nur sinnvoll, wenn die Datei NICHT in die Finanz-App eingelesen wurde.")) { return; }
                var neu = S.exportZurueckholen(x.id);
                zaehlerAktualisieren();
                zeichneExport();
                erinnerung();
                toast(neu + (neu === 1 ? " Eintrag ist" : " Einträge sind") + " wieder in der Liste.");
            });
            knoepfe.appendChild(nochmal);
            knoepfe.appendChild(zurueck);
            li.appendChild(text);
            li.appendChild(knoepfe);
            ul.appendChild(li);
        });
    }

    // ------------------------------------------------------------------ Mehr (Kategorien vom PC, Aussehen, Erinnerung, Anleitung)

    function zeichneMehr() {
        var p = S.pc();
        $("[data-pc-stand]").textContent = p
            ? "Stand vom " + datumText(p.stand) + " · " + mehrzahl(p.kategorien.length, "Kategorie", "Kategorien") + " in " + mehrzahl(p.gruppen.length, "Gruppe", "Gruppen")
            : "Noch nicht übernommen.";
        var a = window.FAfarben.gespeichert();
        $$('input[name="a-modus"]').forEach(function (r) { r.checked = r.value === a.modus; });
        $$('input[name="a-zahlen"]').forEach(function (r) { r.checked = r.value === a.zahlen; });
        $$('input[name="a-schema"]').forEach(function (r) { r.checked = r.value === a.schema; });
        $("[data-erinnerung-tage]").value = String(erinnerungTage());
        var v = S.vorschlaege();
        var eigene = S.alleKategorien().filter(function (k) { return k.quelle === "handy"; }).length;
        var n = v.kategorien.length + v.gruppen.length;
        $("[data-vorschlaege-text]").textContent = n
            ? "Auf dem Handy gemerkt: die zuletzt benutzten Kategorien" + (eigene ? " (davon " + mehrzahl(eigene, "nur hier benutzte", "nur hier benutzte") + ")" : "") +
              " und ihre Gruppen. „Löschen“ setzt das zurück – die Kategorien vom PC und deine Einträge bleiben."
            : "Noch nichts gemerkt. Benutzte Kategorien erscheinen beim Eintragen als „zuletzt benutzt“.";
        $("[data-vorschlaege-loeschen]").disabled = n === 0;
    }

    function schemaKnoepfe() {
        var box = $("[data-schemata]");
        var F = window.FAfarben;
        F.SCHEMATA.forEach(function (s) {
            var id = "schema-" + s;
            var r = el("input");
            r.type = "radio"; r.name = "a-schema"; r.value = s; r.id = id;
            var l = el("label");
            l.htmlFor = id;
            var farbe = el("i");
            farbe.style.background = F.AKZENT[s].dunkel;
            l.appendChild(farbe);
            l.appendChild(document.createTextNode(F.NAMEN[s]));
            box.appendChild(r);
            box.appendChild(l);
        });
    }

    function aussehenGeaendert() {
        var wert = function (name, standard) { var r = $('input[name="' + name + '"]:checked'); return r ? r.value : standard; };
        window.FAfarben.speichern({ modus: wert("a-modus", "dunkel"), schema: wert("a-schema", "blau"), zahlen: wert("a-zahlen", "klassisch") });
    }

    // ------------------------------------------------------------------ H5 Scannen

    var scanner = null;

    function scanStoppen() {
        if (scanner) { scanner.stoppen(); scanner = null; }
    }

    function scanStatus(text, hinweis) {
        var s = $("[data-scan-status]");
        s.textContent = text;
        s.classList.toggle("ist-hinweis", !!hinweis);
    }

    function scanFortschritt(gelesen, anzahl) {
        var box = $("[data-scan-fortschritt]");
        box.hidden = anzahl < 2;
        box.innerHTML = "";
        for (var i = 0; i < anzahl; i++) { box.appendChild(el("span", i < gelesen ? "ist-an" : "")); }
    }

    function scanStarten() {
        scanStoppen();
        $("[data-scan-karte]").hidden = false;
        $("[data-scan-ergebnis]").hidden = true;
        scanFortschritt(0, 0);
        scanStatus("Am PC: „Handy-App“ → „Kategorien aufs Handy“. Dann den Code in den Rahmen halten.");
        $("[data-scan-text]").textContent = "Kamera wird gestartet …";
        var video = $("[data-scan-video]");
        scanner = window.FAscanner.starten(video, {
            beiTeil: function (gelesen, anzahl, doppelt) {
                scanFortschritt(gelesen, anzahl);
                scanStatus(gelesen + " von " + anzahl + " Codes eingesammelt – die Kamera einfach weiter draufhalten.");
                if (!doppelt && navigator.vibrate) { try { navigator.vibrate(40); } catch (e) { /* egal */ } }
            },
            beiFertig: function (paket) {
                scanner = null;
                pcUebernehmen(paket);
            },
            beiHinweis: function (text) { scanStatus(text, true); },
            beiFehler: function (text) {
                $("[data-scan-text]").textContent = "Keine Kamera";
                scanStatus(text, true);
            }
        });
        video.addEventListener("playing", function () { $("[data-scan-text]").textContent = "Code vom PC in den Rahmen halten"; }, { once: true });
    }

    function pcUebernehmen(paket) {
        var r = S.pcUebernehmen(paket);
        var mitAussehen = $("[data-aussehen-uebernehmen]").checked && paket.a;
        var a = null;
        if (mitAussehen) {
            a = window.FAfarben.speichern({ modus: paket.a.m, schema: paket.a.s, zahlen: paket.a.z });
        }
        if (navigator.vibrate) { try { navigator.vibrate([40, 60, 40]); } catch (e) { /* egal */ } }
        $("[data-scan-karte]").hidden = true;
        var erg = $("[data-scan-ergebnis]");
        erg.hidden = false;
        var ul = $("[data-scan-zahlen]");
        ul.innerHTML = "";
        var zeilen = [["Kategorien", r.kategorien], ["Kategoriegruppen", r.gruppen]];
        if (!r.erstmals) { zeilen.push(["neu dazugekommen", r.neu]); }
        zeilen.forEach(function (z) {
            var li = el("li");
            li.appendChild(el("span", null, z[0]));
            li.appendChild(el("b", null, String(z[1])));
            ul.appendChild(li);
        });
        $("[data-scan-zusatz]").textContent = "Stand vom " + datumText(paket.d) + "." +
            (a ? " Aussehen übernommen: " + (a.modus === "hell" ? "Hell" : "Dunkel") + " · " + window.FAfarben.NAMEN[a.schema] + "." : "") +
            (r.gespeichert ? "" : " Achtung: Der Speicher ist voll – die Kategorien gelten nur bis zum Schließen.");
        gruppenFuellen();
        waehleKategorie(f.kategorie.value);
        pcHinweis();
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

        schemaKnoepfe();
        formLeeren();
        gruppenFuellen();
        zaehlerAktualisieren();
        neuHinweis();

        form.addEventListener("submit", formAbschicken);
        $$('input[name="typ"]', form).forEach(function (r) { r.addEventListener("change", artAnzeigen); });
        steuerKnopf.addEventListener("click", function () { setzeSteuer(!f.steuer.checked); });
        f.betrag.addEventListener("input", function () { if (f.betrag.classList.contains("ist-fehler")) { fehler("betrag"); } });
        f.datum.addEventListener("change", function () { fehler("datum"); datumAnzeigen(); });
        $$("[data-datum-wahl]").forEach(function (k) {
            k.addEventListener("click", function () { datumWahl(k.getAttribute("data-datum-wahl")); });
        });
        $("[data-abbrechen]").addEventListener("click", function () {
            formLeeren();
            location.hash = "#liste";
        });

        // Kategorie-Feld (v3)
        f.kategorie.addEventListener("input", kategorieGetippt);
        f.kategorie.addEventListener("change", kategorieFertig);
        f.kategorie.addEventListener("keydown", function (e) {
            if (e.key !== "Enter") { return; }
            e.preventDefault();                 // Enter soll den Eintrag nicht schon speichern
            var text = f.kategorie.value.trim();
            var passend = passendeKategorien(text);
            var exakt = passend.filter(function (x) { return klein(x.name) === klein(text); })[0];
            if (text && (exakt || passend.length === 1)) { waehleKategorie((exakt || passend[0]).name); }
            else { tippModus = false; kategorieFertig(); zeichneKategorieKnoepfe(); }
            f.kategorie.blur();
        });
        $("[data-kat-leeren]").addEventListener("mousedown", function (e) { e.preventDefault(); });
        $("[data-kat-leeren]").addEventListener("click", function () {
            waehleKategorie("");
            f.kategorie.focus();
        });

        // Auswahlblatt
        $$("[data-blatt-zu]").forEach(function (z) { z.addEventListener("click", blattZu); });
        $("[data-blatt-suche]").addEventListener("input", zeichneBlatt);
        $("[data-blatt-suche]").addEventListener("keydown", function (e) {
            if (e.key !== "Enter") { return; }
            e.preventDefault();
            var such = e.target.value.trim();
            if (!such) { return; }
            var treffer = S.alleKategorien().filter(function (k) { return klein(k.name).indexOf(klein(such)) >= 0; });
            var exakt = treffer.filter(function (k) { return klein(k.name) === klein(such); })[0];
            blattWahl(exakt ? exakt.name : (treffer.length === 1 ? treffer[0].name : such));
        });
        document.addEventListener("keydown", function (e) { if (e.key === "Escape") { blattZu(); } });

        $("[data-suche]").addEventListener("input", zeichneListe);
        $$("[data-export]").forEach(function (b) {
            b.addEventListener("click", function () { exportieren(b.getAttribute("data-export")); });
        });
        $("[data-vorschlaege-loeschen]").addEventListener("click", function () {
            if (!window.confirm("Die zuletzt benutzten Kategorien vergessen? Die Kategorien vom PC und deine Einträge bleiben erhalten.")) { return; }
            S.vorschlaegeLoeschen();
            gruppenFuellen();
            waehleKategorie(f.kategorie.value);
            zeichneMehr();
            toast("Vorschläge gelöscht.");
        });
        $$('input[name="a-modus"], input[name="a-zahlen"], input[name="a-schema"]').forEach(function (r) {
            r.addEventListener("change", aussehenGeaendert);
        });
        $("[data-erinnerung-tage]").addEventListener("change", function (e) {
            S.merker("erinnerungTage", Number(e.target.value));
            erinnerung();
            toast(Number(e.target.value) ? "Erinnerung nach " + e.target.value + " Tagen." : "Keine orange Erinnerung mehr.");
        });
        $("[data-pc-hinweis-zu]").addEventListener("click", function () {
            S.merker("pcHinweisZu", true);
            pcHinweis();
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
        // Datum auf "heute" nachziehen, wenn die App über Nacht offen war; Kamera aus, wenn die App in den Hintergrund geht
        var zuletztHeute = heute();
        document.addEventListener("visibilitychange", function () {
            if (document.visibilityState === "hidden") { scanStoppen(); return; }
            if (!bearbeiteId && !f.betrag.value && !f.name.value && f.datum.value === zuletztHeute) {
                f.datum.value = heute();
                datumAnzeigen();
            }
            zuletztHeute = heute();
            if (aktuelleAnsicht() === "scan" && !scanner && !$("[data-scan-karte]").hidden) { scanStarten(); }
            zaehlerAktualisieren();
            erinnerung();
        });
        zeigeAnsicht();
        installHinweis();
        serviceWorker();
    }

    start();

    // für Tests
    window.FAhandy = { leseBetrag: leseBetrag, summen: summen, dateiName: dateiName, erinnerungsInfo: erinnerungsInfo,
        pcUebernehmen: pcUebernehmen, waehleKategorie: waehleKategorie };
})();
