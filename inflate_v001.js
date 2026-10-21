/*
 * inflate_v001.js – Finanzapp Handy 2: entpackt die Kategorien aus dem QR-Code vom PC.
 *
 * Kleiner, eigenständiger Entpacker für das zlib-Format (RFC 1950/1951, wie Pythons zlib.compress).
 * Läuft komplett auf dem Handy, ohne Internet.  FAinflate.zlib(Uint8Array) -> Uint8Array
 */
(function (global) {
    "use strict";

    function Fehler(text) { var e = new Error(text); e.name = "InflateFehler"; return e; }

    var LAENGE_BASIS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
    var LAENGE_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
    var ABST_BASIS = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073,
        4097, 6145, 8193, 12289, 16385, 24577];
    var ABST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
    var CL_REIHENFOLGE = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

    /** Huffman-Tabelle aus Codelängen: {anzahl[16], symbole[]} (kanonisch) */
    function baum(laengen) {
        var anzahl = new Uint16Array(16), symbole = new Uint16Array(laengen.length), versatz = new Uint16Array(16);
        for (var i = 0; i < laengen.length; i++) { anzahl[laengen[i]]++; }
        anzahl[0] = 0;
        for (i = 1; i < 16; i++) { versatz[i] = versatz[i - 1] + anzahl[i - 1]; }
        for (i = 0; i < laengen.length; i++) { if (laengen[i]) { symbole[versatz[laengen[i]]++] = i; } }
        return { anzahl: anzahl, symbole: symbole };
    }

    function Leser(daten, start) { this.d = daten; this.pos = start; this.bit = 0; this.puffer = 0; }
    Leser.prototype.bits = function (n) {
        while (this.bit < n) {
            if (this.pos >= this.d.length) { throw Fehler("Daten zu kurz"); }
            this.puffer |= this.d[this.pos++] << this.bit;
            this.bit += 8;
        }
        var wert = this.puffer & ((1 << n) - 1);
        this.puffer >>>= n;
        this.bit -= n;
        return wert;
    };
    Leser.prototype.symbol = function (t) {
        var code = 0, erst = 0, index = 0;
        for (var laenge = 1; laenge < 16; laenge++) {
            code |= this.bits(1);
            var n = t.anzahl[laenge];
            if (code - n < erst) { return t.symbole[index + (code - erst)]; }
            index += n;
            erst += n;
            erst <<= 1;
            code <<= 1;
        }
        throw Fehler("ungültiger Huffman-Code");
    };

    var FEST_LIT = (function () {
        var l = new Uint8Array(288);
        for (var i = 0; i < 144; i++) { l[i] = 8; }
        for (; i < 256; i++) { l[i] = 9; }
        for (; i < 280; i++) { l[i] = 7; }
        for (; i < 288; i++) { l[i] = 8; }
        return baum(l);
    })();
    var FEST_ABST = (function () { var l = new Uint8Array(30); for (var i = 0; i < 30; i++) { l[i] = 5; } return baum(l); })();

    function dynamisch(L) {
        var hlit = L.bits(5) + 257, hdist = L.bits(5) + 1, hclen = L.bits(4) + 4;
        var cl = new Uint8Array(19);
        for (var i = 0; i < hclen; i++) { cl[CL_REIHENFOLGE[i]] = L.bits(3); }
        var clBaum = baum(cl);
        var laengen = new Uint8Array(hlit + hdist);
        for (i = 0; i < hlit + hdist;) {
            var s = L.symbol(clBaum);
            if (s < 16) { laengen[i++] = s; continue; }
            var wdh, wert = 0;
            if (s === 16) { if (!i) { throw Fehler("Wiederholung ohne Vorgänger"); } wert = laengen[i - 1]; wdh = 3 + L.bits(2); }
            else if (s === 17) { wdh = 3 + L.bits(3); }
            else { wdh = 11 + L.bits(7); }
            if (i + wdh > hlit + hdist) { throw Fehler("zu viele Codelängen"); }
            while (wdh--) { laengen[i++] = wert; }
        }
        return [baum(laengen.subarray(0, hlit)), baum(laengen.subarray(hlit))];
    }

    function inflate(daten, start) {
        var L = new Leser(daten, start || 0);
        var aus = new Uint8Array(Math.max(1024, daten.length * 4)), n = 0;
        function platz(m) {
            if (n + m <= aus.length) { return; }
            var neu = new Uint8Array(Math.max(aus.length * 2, n + m));
            neu.set(aus); aus = neu;
        }
        var letzter;
        do {
            letzter = L.bits(1);
            var art = L.bits(2);
            if (art === 0) {
                L.puffer = 0; L.bit = 0;                       // auf ganze Bytes
                if (L.pos + 4 > daten.length) { throw Fehler("Daten zu kurz"); }
                var len = daten[L.pos] | (daten[L.pos + 1] << 8), nlen = daten[L.pos + 2] | (daten[L.pos + 3] << 8);
                if ((len ^ 0xffff) !== nlen) { throw Fehler("Blocklänge defekt"); }
                L.pos += 4;
                if (L.pos + len > daten.length) { throw Fehler("Daten zu kurz"); }
                platz(len);
                aus.set(daten.subarray(L.pos, L.pos + len), n);
                n += len; L.pos += len;
            } else if (art === 1 || art === 2) {
                var t = art === 1 ? [FEST_LIT, FEST_ABST] : dynamisch(L);
                for (;;) {
                    var sym = L.symbol(t[0]);
                    if (sym < 256) { platz(1); aus[n++] = sym; continue; }
                    if (sym === 256) { break; }
                    sym -= 257;
                    if (sym >= 29) { throw Fehler("ungültige Länge"); }
                    var laenge = LAENGE_BASIS[sym] + L.bits(LAENGE_EXTRA[sym]);
                    var ds = L.symbol(t[1]);
                    if (ds >= 30) { throw Fehler("ungültiger Abstand"); }
                    var abstand = ABST_BASIS[ds] + L.bits(ABST_EXTRA[ds]);
                    if (abstand > n) { throw Fehler("Abstand zu groß"); }
                    platz(laenge);
                    for (var k = 0; k < laenge; k++) { aus[n] = aus[n - abstand]; n++; }
                }
            } else {
                throw Fehler("ungültiger Blocktyp");
            }
        } while (!letzter);
        return { daten: aus.subarray(0, n), ende: L.pos };
    }

    function adler32(d) {
        var a = 1, b = 0;
        for (var i = 0; i < d.length; i++) { a = (a + d[i]) % 65521; b = (b + a) % 65521; }
        return ((b << 16) | a) >>> 0;
    }

    function zlib(daten) {
        if (!(daten instanceof Uint8Array)) { daten = new Uint8Array(daten); }
        if (daten.length < 6) { throw Fehler("Daten zu kurz"); }
        var cmf = daten[0], flg = daten[1];
        if ((cmf & 15) !== 8 || ((cmf << 8) | flg) % 31 !== 0 || (flg & 32)) { throw Fehler("kein zlib-Format"); }
        var r = inflate(daten, 2);
        var e = r.ende;
        if (e + 4 > daten.length) { throw Fehler("Prüfsumme fehlt"); }
        var soll = ((daten[e] << 24) | (daten[e + 1] << 16) | (daten[e + 2] << 8) | daten[e + 3]) >>> 0;
        if (adler32(r.daten) !== soll) { throw Fehler("Prüfsumme falsch"); }
        return r.daten;
    }

    global.FAinflate = { zlib: zlib, inflate: function (d) { return inflate(d, 0).daten; } };
})(typeof window !== "undefined" ? window : globalThis);
