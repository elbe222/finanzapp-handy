/*
 * farben_v001.js – Finanzapp Handy 2: dieselben Farben wie die Finanz-App am PC (farben_v001.py).
 * Erzeugt aus der PC-Version – nicht von Hand ändern. Wendet das gespeicherte Aussehen sofort beim
 * Laden an (vor dem ersten Zeichnen), damit nichts aufblitzt.
 *
 *   FAfarben.anwenden({modus: "dunkel"|"hell", schema: "blau"|..., zahlen: "klassisch"|"blau_orange"})
 */
(function (global) {
    "use strict";
    var CSS = {
"blau|klassisch|dunkel": ":root{--warn:#f59e0b;--gefahr:#b91c1c;--gefahr-hover:#991b1b;--schatten:#000000;--overlay:#020617;--bg:#0f172a;--bg-sidebar:#0b1120;--bg-card:#1e293b;--bg-input:#0f172a;--bg-hover:#25344d;--border:#334155;--border-stark:#475569;--text:#e5e7eb;--text-muted:#94a3b8;--accent:#3b82f6;--accent-hover:#2563eb;--auf-akzent:#ffffff;--akzent-text:#93c5fd;--einnahmen:#22c55e;--ausgaben:#ef4444;--investiert:#a78bfa;--saldo:#60a5fa;--einnahmen-text:#86efac;--ausgaben-text:#fca5a5;--investiert-text:#c4b5fd;color-scheme:dark;}",
"blau|klassisch|hell": ":root{--warn:#b45309;--gefahr:#dc2626;--gefahr-hover:#b91c1c;--schatten:#64748b;--overlay:#0f172a;--bg:#f3f5f9;--bg-sidebar:#e8ecf3;--bg-card:#ffffff;--bg-input:#f8fafc;--bg-hover:#e4e9f2;--border:#d5dce7;--border-stark:#aab6c8;--text:#0f172a;--text-muted:#556175;--accent:#2563eb;--accent-hover:#1d4ed8;--auf-akzent:#ffffff;--akzent-text:#1d4ed8;--einnahmen:#15803d;--ausgaben:#dc2626;--investiert:#7c3aed;--saldo:#2563eb;--einnahmen-text:#166534;--ausgaben-text:#b91c1c;--investiert-text:#6d28d9;color-scheme:light;}",
"blau|blau_orange|dunkel": ":root{--warn:#f59e0b;--gefahr:#b91c1c;--gefahr-hover:#991b1b;--schatten:#000000;--overlay:#020617;--bg:#0f172a;--bg-sidebar:#0b1120;--bg-card:#1e293b;--bg-input:#0f172a;--bg-hover:#25344d;--border:#334155;--border-stark:#475569;--text:#e5e7eb;--text-muted:#94a3b8;--accent:#3b82f6;--accent-hover:#2563eb;--auf-akzent:#ffffff;--akzent-text:#93c5fd;--einnahmen:#38bdf8;--ausgaben:#fb923c;--investiert:#d8b4fe;--saldo:#facc15;--einnahmen-text:#bae6fd;--ausgaben-text:#fed7aa;--investiert-text:#e9d5ff;color-scheme:dark;}",
"blau|blau_orange|hell": ":root{--warn:#b45309;--gefahr:#dc2626;--gefahr-hover:#b91c1c;--schatten:#64748b;--overlay:#0f172a;--bg:#f3f5f9;--bg-sidebar:#e8ecf3;--bg-card:#ffffff;--bg-input:#f8fafc;--bg-hover:#e4e9f2;--border:#d5dce7;--border-stark:#aab6c8;--text:#0f172a;--text-muted:#556175;--accent:#2563eb;--accent-hover:#1d4ed8;--auf-akzent:#ffffff;--akzent-text:#1d4ed8;--einnahmen:#0369a1;--ausgaben:#c2410c;--investiert:#7e22ce;--saldo:#a16207;--einnahmen-text:#075985;--ausgaben-text:#9a3412;--investiert-text:#6b21a8;color-scheme:light;}",
"petrol|klassisch|dunkel": ":root{--warn:#f59e0b;--gefahr:#b91c1c;--gefahr-hover:#991b1b;--schatten:#000000;--overlay:#020617;--bg:#0c1a1d;--bg-sidebar:#081315;--bg-card:#152c30;--bg-input:#0c1a1d;--bg-hover:#1c383d;--border:#28474c;--border-stark:#3d6166;--text:#e3eeee;--text-muted:#8fb0b2;--accent:#14b8a6;--accent-hover:#0d9488;--auf-akzent:#042f2e;--akzent-text:#5eead4;--einnahmen:#22c55e;--ausgaben:#ef4444;--investiert:#a78bfa;--saldo:#60a5fa;--einnahmen-text:#86efac;--ausgaben-text:#fca5a5;--investiert-text:#c4b5fd;color-scheme:dark;}",
"petrol|klassisch|hell": ":root{--warn:#b45309;--gefahr:#dc2626;--gefahr-hover:#b91c1c;--schatten:#64748b;--overlay:#0f172a;--bg:#f1f7f7;--bg-sidebar:#e2efef;--bg-card:#ffffff;--bg-input:#f7fbfb;--bg-hover:#dfeded;--border:#cde0e1;--border-stark:#9fbfc1;--text:#0b2224;--text-muted:#4b686b;--accent:#0f766e;--accent-hover:#115e59;--auf-akzent:#ffffff;--akzent-text:#0f766e;--einnahmen:#15803d;--ausgaben:#dc2626;--investiert:#7c3aed;--saldo:#2563eb;--einnahmen-text:#166534;--ausgaben-text:#b91c1c;--investiert-text:#6d28d9;color-scheme:light;}",
"petrol|blau_orange|dunkel": ":root{--warn:#f59e0b;--gefahr:#b91c1c;--gefahr-hover:#991b1b;--schatten:#000000;--overlay:#020617;--bg:#0c1a1d;--bg-sidebar:#081315;--bg-card:#152c30;--bg-input:#0c1a1d;--bg-hover:#1c383d;--border:#28474c;--border-stark:#3d6166;--text:#e3eeee;--text-muted:#8fb0b2;--accent:#14b8a6;--accent-hover:#0d9488;--auf-akzent:#042f2e;--akzent-text:#5eead4;--einnahmen:#38bdf8;--ausgaben:#fb923c;--investiert:#d8b4fe;--saldo:#facc15;--einnahmen-text:#bae6fd;--ausgaben-text:#fed7aa;--investiert-text:#e9d5ff;color-scheme:dark;}",
"petrol|blau_orange|hell": ":root{--warn:#b45309;--gefahr:#dc2626;--gefahr-hover:#b91c1c;--schatten:#64748b;--overlay:#0f172a;--bg:#f1f7f7;--bg-sidebar:#e2efef;--bg-card:#ffffff;--bg-input:#f7fbfb;--bg-hover:#dfeded;--border:#cde0e1;--border-stark:#9fbfc1;--text:#0b2224;--text-muted:#4b686b;--accent:#0f766e;--accent-hover:#115e59;--auf-akzent:#ffffff;--akzent-text:#0f766e;--einnahmen:#0369a1;--ausgaben:#c2410c;--investiert:#7e22ce;--saldo:#a16207;--einnahmen-text:#075985;--ausgaben-text:#9a3412;--investiert-text:#6b21a8;color-scheme:light;}",
"lila|klassisch|dunkel": ":root{--warn:#f59e0b;--gefahr:#b91c1c;--gefahr-hover:#991b1b;--schatten:#000000;--overlay:#020617;--bg:#15111f;--bg-sidebar:#0f0c17;--bg-card:#231d34;--bg-input:#15111f;--bg-hover:#2d2543;--border:#3c3356;--border-stark:#564a7c;--text:#ece8f5;--text-muted:#a59dbb;--accent:#7c3aed;--accent-hover:#6d28d9;--auf-akzent:#ffffff;--akzent-text:#c4b5fd;--einnahmen:#22c55e;--ausgaben:#ef4444;--investiert:#a78bfa;--saldo:#60a5fa;--einnahmen-text:#86efac;--ausgaben-text:#fca5a5;--investiert-text:#c4b5fd;color-scheme:dark;}",
"lila|klassisch|hell": ":root{--warn:#b45309;--gefahr:#dc2626;--gefahr-hover:#b91c1c;--schatten:#64748b;--overlay:#0f172a;--bg:#f6f4fb;--bg-sidebar:#ebe7f6;--bg-card:#ffffff;--bg-input:#faf9fd;--bg-hover:#e9e4f6;--border:#dbd4ec;--border-stark:#b8acd6;--text:#1b1530;--text-muted:#605879;--accent:#7c3aed;--accent-hover:#6d28d9;--auf-akzent:#ffffff;--akzent-text:#6d28d9;--einnahmen:#15803d;--ausgaben:#dc2626;--investiert:#7c3aed;--saldo:#2563eb;--einnahmen-text:#166534;--ausgaben-text:#b91c1c;--investiert-text:#6d28d9;color-scheme:light;}",
"lila|blau_orange|dunkel": ":root{--warn:#f59e0b;--gefahr:#b91c1c;--gefahr-hover:#991b1b;--schatten:#000000;--overlay:#020617;--bg:#15111f;--bg-sidebar:#0f0c17;--bg-card:#231d34;--bg-input:#15111f;--bg-hover:#2d2543;--border:#3c3356;--border-stark:#564a7c;--text:#ece8f5;--text-muted:#a59dbb;--accent:#7c3aed;--accent-hover:#6d28d9;--auf-akzent:#ffffff;--akzent-text:#c4b5fd;--einnahmen:#38bdf8;--ausgaben:#fb923c;--investiert:#d8b4fe;--saldo:#facc15;--einnahmen-text:#bae6fd;--ausgaben-text:#fed7aa;--investiert-text:#e9d5ff;color-scheme:dark;}",
"lila|blau_orange|hell": ":root{--warn:#b45309;--gefahr:#dc2626;--gefahr-hover:#b91c1c;--schatten:#64748b;--overlay:#0f172a;--bg:#f6f4fb;--bg-sidebar:#ebe7f6;--bg-card:#ffffff;--bg-input:#faf9fd;--bg-hover:#e9e4f6;--border:#dbd4ec;--border-stark:#b8acd6;--text:#1b1530;--text-muted:#605879;--accent:#7c3aed;--accent-hover:#6d28d9;--auf-akzent:#ffffff;--akzent-text:#6d28d9;--einnahmen:#0369a1;--ausgaben:#c2410c;--investiert:#7e22ce;--saldo:#a16207;--einnahmen-text:#075985;--ausgaben-text:#9a3412;--investiert-text:#6b21a8;color-scheme:light;}",
"bernstein|klassisch|dunkel": ":root{--warn:#f59e0b;--gefahr:#b91c1c;--gefahr-hover:#991b1b;--schatten:#000000;--overlay:#020617;--bg:#19140c;--bg-sidebar:#110d07;--bg-card:#2a2115;--bg-input:#19140c;--bg-hover:#362b1c;--border:#4a3b26;--border-stark:#66533a;--text:#f4ede2;--text-muted:#b8a78d;--accent:#f59e0b;--accent-hover:#d97706;--auf-akzent:#1f1300;--akzent-text:#fcd34d;--einnahmen:#22c55e;--ausgaben:#ef4444;--investiert:#a78bfa;--saldo:#60a5fa;--einnahmen-text:#86efac;--ausgaben-text:#fca5a5;--investiert-text:#c4b5fd;color-scheme:dark;}",
"bernstein|klassisch|hell": ":root{--warn:#b45309;--gefahr:#dc2626;--gefahr-hover:#b91c1c;--schatten:#64748b;--overlay:#0f172a;--bg:#fbf7f0;--bg-sidebar:#f3eadb;--bg-card:#ffffff;--bg-input:#fdfaf5;--bg-hover:#f1e6d3;--border:#e8dbc3;--border-stark:#cfbb97;--text:#23190b;--text-muted:#6c5c42;--accent:#b45309;--accent-hover:#92400e;--auf-akzent:#ffffff;--akzent-text:#92400e;--einnahmen:#15803d;--ausgaben:#dc2626;--investiert:#7c3aed;--saldo:#2563eb;--einnahmen-text:#166534;--ausgaben-text:#b91c1c;--investiert-text:#6d28d9;color-scheme:light;}",
"bernstein|blau_orange|dunkel": ":root{--warn:#f59e0b;--gefahr:#b91c1c;--gefahr-hover:#991b1b;--schatten:#000000;--overlay:#020617;--bg:#19140c;--bg-sidebar:#110d07;--bg-card:#2a2115;--bg-input:#19140c;--bg-hover:#362b1c;--border:#4a3b26;--border-stark:#66533a;--text:#f4ede2;--text-muted:#b8a78d;--accent:#f59e0b;--accent-hover:#d97706;--auf-akzent:#1f1300;--akzent-text:#fcd34d;--einnahmen:#38bdf8;--ausgaben:#fb923c;--investiert:#d8b4fe;--saldo:#facc15;--einnahmen-text:#bae6fd;--ausgaben-text:#fed7aa;--investiert-text:#e9d5ff;color-scheme:dark;}",
"bernstein|blau_orange|hell": ":root{--warn:#b45309;--gefahr:#dc2626;--gefahr-hover:#b91c1c;--schatten:#64748b;--overlay:#0f172a;--bg:#fbf7f0;--bg-sidebar:#f3eadb;--bg-card:#ffffff;--bg-input:#fdfaf5;--bg-hover:#f1e6d3;--border:#e8dbc3;--border-stark:#cfbb97;--text:#23190b;--text-muted:#6c5c42;--accent:#b45309;--accent-hover:#92400e;--auf-akzent:#ffffff;--akzent-text:#92400e;--einnahmen:#0369a1;--ausgaben:#c2410c;--investiert:#7e22ce;--saldo:#a16207;--einnahmen-text:#075985;--ausgaben-text:#9a3412;--investiert-text:#6b21a8;color-scheme:light;}",
"graphit|klassisch|dunkel": ":root{--warn:#f59e0b;--gefahr:#b91c1c;--gefahr-hover:#991b1b;--schatten:#000000;--overlay:#020617;--bg:#141414;--bg-sidebar:#0d0d0d;--bg-card:#222222;--bg-input:#141414;--bg-hover:#2d2d2d;--border:#3a3a3a;--border-stark:#565656;--text:#ececec;--text-muted:#a3a3a3;--accent:#d4d4d4;--accent-hover:#b8b8b8;--auf-akzent:#171717;--akzent-text:#e5e5e5;--einnahmen:#22c55e;--ausgaben:#ef4444;--investiert:#a78bfa;--saldo:#60a5fa;--einnahmen-text:#86efac;--ausgaben-text:#fca5a5;--investiert-text:#c4b5fd;color-scheme:dark;}",
"graphit|klassisch|hell": ":root{--warn:#b45309;--gefahr:#dc2626;--gefahr-hover:#b91c1c;--schatten:#64748b;--overlay:#0f172a;--bg:#f4f4f4;--bg-sidebar:#e9e9e9;--bg-card:#ffffff;--bg-input:#fafafa;--bg-hover:#e6e6e6;--border:#d6d6d6;--border-stark:#b0b0b0;--text:#171717;--text-muted:#5c5c5c;--accent:#3f3f3f;--accent-hover:#262626;--auf-akzent:#ffffff;--akzent-text:#262626;--einnahmen:#15803d;--ausgaben:#dc2626;--investiert:#7c3aed;--saldo:#2563eb;--einnahmen-text:#166534;--ausgaben-text:#b91c1c;--investiert-text:#6d28d9;color-scheme:light;}",
"graphit|blau_orange|dunkel": ":root{--warn:#f59e0b;--gefahr:#b91c1c;--gefahr-hover:#991b1b;--schatten:#000000;--overlay:#020617;--bg:#141414;--bg-sidebar:#0d0d0d;--bg-card:#222222;--bg-input:#141414;--bg-hover:#2d2d2d;--border:#3a3a3a;--border-stark:#565656;--text:#ececec;--text-muted:#a3a3a3;--accent:#d4d4d4;--accent-hover:#b8b8b8;--auf-akzent:#171717;--akzent-text:#e5e5e5;--einnahmen:#38bdf8;--ausgaben:#fb923c;--investiert:#d8b4fe;--saldo:#facc15;--einnahmen-text:#bae6fd;--ausgaben-text:#fed7aa;--investiert-text:#e9d5ff;color-scheme:dark;}",
"graphit|blau_orange|hell": ":root{--warn:#b45309;--gefahr:#dc2626;--gefahr-hover:#b91c1c;--schatten:#64748b;--overlay:#0f172a;--bg:#f4f4f4;--bg-sidebar:#e9e9e9;--bg-card:#ffffff;--bg-input:#fafafa;--bg-hover:#e6e6e6;--border:#d6d6d6;--border-stark:#b0b0b0;--text:#171717;--text-muted:#5c5c5c;--accent:#3f3f3f;--accent-hover:#262626;--auf-akzent:#ffffff;--akzent-text:#262626;--einnahmen:#0369a1;--ausgaben:#c2410c;--investiert:#7e22ce;--saldo:#a16207;--einnahmen-text:#075985;--ausgaben-text:#9a3412;--investiert-text:#6b21a8;color-scheme:light;}"
};
    var AKZENT = {"blau": {"dunkel": "#3b82f6", "hell": "#2563eb"}, "petrol": {"dunkel": "#14b8a6", "hell": "#0f766e"}, "lila": {"dunkel": "#7c3aed", "hell": "#7c3aed"}, "bernstein": {"dunkel": "#f59e0b", "hell": "#b45309"}, "graphit": {"dunkel": "#d4d4d4", "hell": "#3f3f3f"}};
    var LEISTE = {"blau": {"dunkel": "#0b1120", "hell": "#e8ecf3"}, "petrol": {"dunkel": "#081315", "hell": "#e2efef"}, "lila": {"dunkel": "#0f0c17", "hell": "#ebe7f6"}, "bernstein": {"dunkel": "#110d07", "hell": "#f3eadb"}, "graphit": {"dunkel": "#0d0d0d", "hell": "#e9e9e9"}};
    var NAMEN = {"blau": "Blau", "petrol": "Petrol", "lila": "Lila", "bernstein": "Bernstein", "graphit": "Graphit"};
    var SCHEMATA = ["blau", "petrol", "lila", "bernstein", "graphit"];
    var STANDARD = { modus: "dunkel", schema: "blau", zahlen: "klassisch" };
    var SCHLUESSEL = "fa-handy:aussehen";

    function sauber(a) {
        a = a || {};
        return {
            modus: a.modus === "hell" ? "hell" : "dunkel",
            schema: SCHEMATA.indexOf(a.schema) >= 0 ? a.schema : STANDARD.schema,
            zahlen: a.zahlen === "blau_orange" ? "blau_orange" : "klassisch"
        };
    }

    function gespeichert() {
        try { return sauber(JSON.parse(global.localStorage.getItem(SCHLUESSEL) || "null")); }
        catch (e) { return sauber(null); }
    }

    function anwenden(a) {
        a = sauber(a);
        var stil = document.getElementById("farben");
        if (!stil) {
            stil = document.createElement("style");
            stil.id = "farben";
            document.head.appendChild(stil);
        }
        stil.textContent = CSS[a.schema + "|" + a.zahlen + "|" + a.modus];
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) { meta.setAttribute("content", LEISTE[a.schema][a.modus]); }
        var cs = document.querySelector('meta[name="color-scheme"]');
        if (cs) { cs.setAttribute("content", a.modus === "hell" ? "light" : "dark"); }
        document.documentElement.setAttribute("data-modus", a.modus);
        return a;
    }

    function speichern(a) {
        a = sauber(a);
        try { global.localStorage.setItem(SCHLUESSEL, JSON.stringify(a)); } catch (e) { /* privater Modus */ }
        return anwenden(a);
    }

    global.FAfarben = {
        anwenden: anwenden, speichern: speichern, gespeichert: gespeichert, sauber: sauber,
        SCHEMATA: SCHEMATA, NAMEN: NAMEN, AKZENT: AKZENT, STANDARD: STANDARD
    };
    anwenden(gespeichert());
})(window);
