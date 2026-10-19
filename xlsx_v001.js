/*
 * xlsx_v001.js – Finanzapp Handy (H3: Excel-Export)
 *
 * Erzeugt direkt auf dem Handy eine echte Excel-Datei (.xlsx), ohne fremde
 * Bibliothek und ohne Internet. Aufbau exakt wie die Import-Vorlage der WebApp
 * (import_excel_v006): Blatt „Einträge“ mit den Spalten
 *   Name | Datum | Art | Betrag (€) | Kategorie | Kategoriegruppe | Steuerrelevant
 * Datum als echtes Excel-Datum (TT.MM.JJJJ), Betrag als Zahl (#.##0,00).
 * Dazu ein Blatt „Info“ mit Zeitpunkt, Anzahl und Hinweis zum Einlesen.
 *
 * Eine .xlsx ist ein ZIP-Archiv mit XML-Dateien. Die Dateien werden
 * unkomprimiert („stored“) abgelegt – das kann jedes Excel lesen.
 */
(function (global) {
    "use strict";

    var SPALTEN = ["Name", "Datum", "Art", "Betrag (€)", "Kategorie", "Kategoriegruppe", "Steuerrelevant"];
    var BREITEN = [32, 14, 18, 14, 24, 24, 16];
    var PFLICHT = { "Datum": true, "Art": true, "Betrag (€)": true };

    // ------------------------------------------------------------------ Hilfen

    function xml(text) {
        return String(text == null ? "" : text)
            // Steuerzeichen sind in XML nicht erlaubt
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function spaltenName(i) {           // 0 -> A, 1 -> B, ...
        var s = "";
        i += 1;
        while (i > 0) { var r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); }
        return s;
    }

    /** "2026-10-19" -> Excel-Seriennummer (Tage seit 30.12.1899) */
    function excelDatum(iso) {
        var t = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
        if (!t) { return null; }
        return Date.UTC(+t[1], +t[2] - 1, +t[3]) / 86400000 + 25569;
    }

    /** Art-Text so, wie ihn der Import der WebApp versteht */
    function artText(e) {
        if (e.typ === "Investment") { return e.rueckfluss === "ja" ? "Investment zurück" : "Investment"; }
        return e.typ === "Einnahme" ? "Einnahme" : "Ausgabe";
    }

    function zelleText(ref, text, stil) {
        return '<c r="' + ref + '" t="inlineStr"' + (stil ? ' s="' + stil + '"' : "") +
            '><is><t xml:space="preserve">' + xml(text) + "</t></is></c>";
    }

    function zelleZahl(ref, zahl, stil) {
        return '<c r="' + ref + '"' + (stil ? ' s="' + stil + '"' : "") + "><v>" + zahl + "</v></c>";
    }

    // ------------------------------------------------------------------ XML-Teile

    var KOPF = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    var NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    var NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

    function contentTypes() {
        return KOPF +
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
            '<Default Extension="xml" ContentType="application/xml"/>' +
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
            '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
            '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
            '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
            '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
            '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
            "</Types>";
    }

    function rootRels() {
        return KOPF +
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
            '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
            "</Relationships>";
    }

    function coreProps(jetzt) {
        var iso = jetzt.toISOString().replace(/\.\d{3}Z$/, "Z");
        return KOPF +
            '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
            'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
            'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
            "<dc:title>Finanzapp Handy – Export</dc:title><dc:creator>Finanzapp Handy</dc:creator>" +
            '<dcterms:created xsi:type="dcterms:W3CDTF">' + iso + "</dcterms:created>" +
            '<dcterms:modified xsi:type="dcterms:W3CDTF">' + iso + "</dcterms:modified>" +
            "</cp:coreProperties>";
    }

    function appProps() {
        return KOPF +
            '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">' +
            "<Application>Finanzapp Handy</Application></Properties>";
    }

    function workbook() {
        return KOPF +
            '<workbook xmlns="' + NS_MAIN + '" xmlns:r="' + NS_REL + '">' +
            '<bookViews><workbookView activeTab="0"/></bookViews>' +
            '<sheets><sheet name="Einträge" sheetId="1" r:id="rId1"/><sheet name="Info" sheetId="2" r:id="rId2"/></sheets>' +
            "</workbook>";
    }

    function workbookRels() {
        return KOPF +
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>' +
            '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
            "</Relationships>";
    }

    // Stile: 0 Standard | 1 Kopf blau | 2 Kopf dunkelblau (Pflicht) | 3 Datum | 4 Betrag | 5 fett | 6 Zeitpunkt
    function styles() {
        return KOPF +
            '<styleSheet xmlns="' + NS_MAIN + '">' +
            '<numFmts count="2"><numFmt numFmtId="164" formatCode="DD.MM.YYYY"/><numFmt numFmtId="165" formatCode="DD.MM.YYYY HH:MM"/></numFmts>' +
            '<fonts count="3">' +
            '<font><sz val="11"/><name val="Arial"/><family val="2"/></font>' +
            '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/><family val="2"/></font>' +
            '<font><b/><sz val="11"/><name val="Arial"/><family val="2"/></font>' +
            "</fonts>" +
            '<fills count="4">' +
            '<fill><patternFill patternType="none"/></fill>' +
            '<fill><patternFill patternType="gray125"/></fill>' +
            '<fill><patternFill patternType="solid"><fgColor rgb="FF2563EB"/><bgColor indexed="64"/></patternFill></fill>' +
            '<fill><patternFill patternType="solid"><fgColor rgb="FF1D4ED8"/><bgColor indexed="64"/></patternFill></fill>' +
            "</fills>" +
            '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
            '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
            '<cellXfs count="7">' +
            '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
            '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center"/></xf>' +
            '<xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center"/></xf>' +
            '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
            '<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
            '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
            '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left"/></xf>' +
            "</cellXfs>" +
            '<cellStyles count="1"><cellStyle name="Standard" xfId="0" builtinId="0"/></cellStyles>' +
            "</styleSheet>";
    }

    function blattEintraege(eintraege) {
        var zeilen = [];
        var kopf = SPALTEN.map(function (titel, i) {
            return zelleText(spaltenName(i) + "1", titel, PFLICHT[titel] ? 2 : 1);
        }).join("");
        zeilen.push('<row r="1">' + kopf + "</row>");
        eintraege.forEach(function (e, n) {
            var r = n + 2;
            var z = [];
            if (e.beschreibung) { z.push(zelleText("A" + r, e.beschreibung)); }
            var d = excelDatum(e.datum);
            z.push(d === null ? zelleText("B" + r, e.datum || "") : zelleZahl("B" + r, d, 3));
            z.push(zelleText("C" + r, artText(e)));
            z.push(zelleZahl("D" + r, Math.round(Number(e.betrag) * 100) / 100, 4));
            if (e.kategorie) { z.push(zelleText("E" + r, e.kategorie)); }
            if (e.gruppe) { z.push(zelleText("F" + r, e.gruppe)); }
            z.push(zelleText("G" + r, e.steuerrelevant ? "Ja" : "Nein"));
            zeilen.push('<row r="' + r + '">' + z.join("") + "</row>");
        });
        var cols = BREITEN.map(function (b, i) {
            return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + b + '" customWidth="1"/>';
        }).join("");
        return KOPF +
            '<worksheet xmlns="' + NS_MAIN + '" xmlns:r="' + NS_REL + '">' +
            '<dimension ref="A1:G' + (eintraege.length + 1) + '"/>' +
            '<sheetViews><sheetView tabSelected="1" workbookViewId="0">' +
            '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
            '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>' +
            '<sheetFormatPr defaultRowHeight="15"/>' +
            "<cols>" + cols + "</cols>" +
            "<sheetData>" + zeilen.join("") + "</sheetData>" +
            "</worksheet>";
    }

    function blattInfo(eintraege, jetzt) {
        // Ortszeit als Excel-Zahl (Tage + Tagesbruchteil)
        var lokal = Date.UTC(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate(),
            jetzt.getHours(), jetzt.getMinutes(), jetzt.getSeconds()) / 86400000 + 25569;
        var texte = [
            ["Finanzapp Handy – Export", null],
            ["Exportiert am", lokal],
            ["Anzahl Einträge", eintraege.length],
            ["So einlesen", "WebApp im komplexen Modus öffnen → „Eintragen“ → „Mehrere Einträge aus einer Excel-Datei“ → diese Datei hochladen."],
            ["Doppelt eingelesen?", "Liest du dieselbe Datei zweimal ein, erkennt die WebApp die Einträge als mögliche Dubletten und fragt nach."]
        ];
        var zeilen = texte.map(function (t, n) {
            var r = n + 1;
            var a = zelleText("A" + r, t[0], 5);
            var b = "";
            if (typeof t[1] === "number") { b = zelleZahl("B" + r, t[1], n === 1 ? 6 : 0); }
            else if (t[1]) { b = zelleText("B" + r, t[1]); }
            return '<row r="' + r + '">' + a + b + "</row>";
        });
        return KOPF +
            '<worksheet xmlns="' + NS_MAIN + '" xmlns:r="' + NS_REL + '">' +
            '<sheetViews><sheetView workbookViewId="0"/></sheetViews>' +
            '<sheetFormatPr defaultRowHeight="15"/>' +
            '<cols><col min="1" max="1" width="24" customWidth="1"/><col min="2" max="2" width="110" customWidth="1"/></cols>' +
            "<sheetData>" + zeilen.join("") + "</sheetData>" +
            "</worksheet>";
    }

    // ------------------------------------------------------------------ ZIP (unkomprimiert)

    var CRC_TABELLE = (function () {
        var t = new Uint32Array(256);
        for (var n = 0; n < 256; n++) {
            var c = n;
            for (var k = 0; k < 8; k++) { c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); }
            t[n] = c >>> 0;
        }
        return t;
    })();

    function crc32(bytes) {
        var c = 0xFFFFFFFF;
        for (var i = 0; i < bytes.length; i++) { c = CRC_TABELLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8); }
        return (c ^ 0xFFFFFFFF) >>> 0;
    }

    function utf8(text) {
        return new TextEncoder().encode(text);
    }

    function zip(dateien, jetzt) {
        // DOS-Zeit/Datum
        var zeit = (jetzt.getHours() << 11) | (jetzt.getMinutes() << 5) | Math.floor(jetzt.getSeconds() / 2);
        var datum = ((jetzt.getFullYear() - 1980) << 9) | ((jetzt.getMonth() + 1) << 5) | jetzt.getDate();
        var teile = [];
        var verzeichnis = [];
        var versatz = 0;

        dateien.forEach(function (d) {
            var name = utf8(d.name);
            var daten = utf8(d.inhalt);
            var crc = crc32(daten);
            var kopf = new DataView(new ArrayBuffer(30));
            kopf.setUint32(0, 0x04034b50, true);
            kopf.setUint16(4, 20, true);          // benoetigte Version
            kopf.setUint16(6, 0x0800, true);      // Namen in UTF-8
            kopf.setUint16(8, 0, true);           // stored
            kopf.setUint16(10, zeit, true);
            kopf.setUint16(12, datum, true);
            kopf.setUint32(14, crc, true);
            kopf.setUint32(18, daten.length, true);
            kopf.setUint32(22, daten.length, true);
            kopf.setUint16(26, name.length, true);
            kopf.setUint16(28, 0, true);
            teile.push(new Uint8Array(kopf.buffer), name, daten);

            var z = new DataView(new ArrayBuffer(46));
            z.setUint32(0, 0x02014b50, true);
            z.setUint16(4, 20, true);
            z.setUint16(6, 20, true);
            z.setUint16(8, 0x0800, true);
            z.setUint16(10, 0, true);
            z.setUint16(12, zeit, true);
            z.setUint16(14, datum, true);
            z.setUint32(16, crc, true);
            z.setUint32(20, daten.length, true);
            z.setUint32(24, daten.length, true);
            z.setUint16(28, name.length, true);
            z.setUint16(30, 0, true);
            z.setUint16(32, 0, true);
            z.setUint16(34, 0, true);
            z.setUint16(36, 0, true);
            z.setUint32(38, 0, true);
            z.setUint32(42, versatz, true);
            verzeichnis.push(new Uint8Array(z.buffer), name);

            versatz += 30 + name.length + daten.length;
        });

        var vzGroesse = verzeichnis.reduce(function (s, t) { return s + t.length; }, 0);
        var ende = new DataView(new ArrayBuffer(22));
        ende.setUint32(0, 0x06054b50, true);
        ende.setUint16(8, dateien.length, true);
        ende.setUint16(10, dateien.length, true);
        ende.setUint32(12, vzGroesse, true);
        ende.setUint32(16, versatz, true);

        var alle = teile.concat(verzeichnis, [new Uint8Array(ende.buffer)]);
        var gesamt = alle.reduce(function (s, t) { return s + t.length; }, 0);
        var ergebnis = new Uint8Array(gesamt);
        var pos = 0;
        alle.forEach(function (t) { ergebnis.set(t, pos); pos += t.length; });
        return ergebnis;
    }

    // ------------------------------------------------------------------ öffentlich

    /**
     * eintraege: [{datum:"JJJJ-MM-TT", typ, rueckfluss, betrag, beschreibung, kategorie, gruppe, steuerrelevant}]
     * Rückgabe: Uint8Array mit der .xlsx-Datei
     */
    function erstelle(eintraege, jetzt) {
        jetzt = jetzt || new Date();
        var sortiert = eintraege.slice().sort(function (a, b) {
            return a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : (a.erstellt || 0) - (b.erstellt || 0);
        });
        return zip([
            { name: "[Content_Types].xml", inhalt: contentTypes() },
            { name: "_rels/.rels", inhalt: rootRels() },
            { name: "docProps/core.xml", inhalt: coreProps(jetzt) },
            { name: "docProps/app.xml", inhalt: appProps() },
            { name: "xl/workbook.xml", inhalt: workbook() },
            { name: "xl/_rels/workbook.xml.rels", inhalt: workbookRels() },
            { name: "xl/styles.xml", inhalt: styles() },
            { name: "xl/worksheets/sheet1.xml", inhalt: blattEintraege(sortiert) },
            { name: "xl/worksheets/sheet2.xml", inhalt: blattInfo(sortiert, jetzt) }
        ], jetzt);
    }

    var MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    var api = { erstelle: erstelle, artText: artText, excelDatum: excelDatum, MIME: MIME, SPALTEN: SPALTEN };
    global.FAxlsx = api;
    if (typeof module !== "undefined" && module.exports) { module.exports = api; }
})(typeof window !== "undefined" ? window : globalThis);
