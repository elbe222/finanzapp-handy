/*
 * sw.js – Finanzapp Handy: macht die App offline nutzbar und liefert Updates.
 *
 * Alle Programmdateien werden beim ersten Öffnen auf dem Handy zwischengespeichert.
 * Danach startet die App auch ohne Internet. Bei einer neuen Version (VERSION
 * und Dateiliste unten ändern sich) lädt das Handy die neuen Dateien im
 * Hintergrund; die App zeigt dann „Eine neue Version ist da“.
 *
 * Die Einträge selbst liegen NICHT hier, sondern im Speicher der App (localStorage)
 * und bleiben bei Updates erhalten.
 */
var VERSION = "finanzapp-handy-1";
var DATEIEN = [
    "./",
    "index.html",
    "manifest.webmanifest",
    "webapp_v014.css",
    "handy_v001.css",
    "speicher_v001.js",
    "xlsx_v001.js",
    "app_v001.js",
    "favicon-32.png",
    "apple-touch-icon.png",
    "icon-192.png",
    "icon-512.png",
    "icon-maskable-512.png"
];

self.addEventListener("install", function (event) {
    event.waitUntil(
        caches.open(VERSION).then(function (cache) {
            // cache: "reload" -> frisch vom Server, nicht aus dem Browser-Zwischenspeicher
            return cache.addAll(DATEIEN.map(function (url) { return new Request(url, { cache: "reload" }); }));
        })
    );
});

self.addEventListener("activate", function (event) {
    event.waitUntil(
        caches.keys().then(function (namen) {
            return Promise.all(namen.filter(function (n) {
                return n.indexOf("finanzapp-handy-") === 0 && n !== VERSION;
            }).map(function (n) { return caches.delete(n); }));
        }).then(function () { return self.clients.claim(); })
    );
});

// "Jetzt aktualisieren" in der App
self.addEventListener("message", function (event) {
    if (event.data && event.data.typ === "aktivieren") { self.skipWaiting(); }
});

self.addEventListener("fetch", function (event) {
    var anfrage = event.request;
    if (anfrage.method !== "GET" || new URL(anfrage.url).origin !== self.location.origin) { return; }
    if (anfrage.mode === "navigate") {
        // Seitenaufruf: immer die gespeicherte App-Seite (funktioniert offline)
        event.respondWith(
            caches.match("index.html", { cacheName: VERSION }).then(function (antwort) {
                return antwort || fetch(anfrage);
            })
        );
        return;
    }
    event.respondWith(
        caches.match(anfrage, { cacheName: VERSION, ignoreSearch: true }).then(function (antwort) {
            return antwort || fetch(anfrage);
        })
    );
});
