# Naloga 4 - Simulacija zivljenja

Projekt prikazuje 2D simulacijo zivljenja z lisicami, zajci in rastlinami.

V simulaciji so vključeni:
- teren z vodo in kopnim,
- stirje razlicni prednastavljeni tereni,
- generiranje terena s Perlinovim sumom,
- potrebe bitij: lakota, zeja in razmnozevanje,
- starost, zaznava, spol, hitrost, velikost in variacija,
- lov, beg, dedovanje in mutacije,
- uporabniski vmesnik za nastavljanje zacetnih parametrov,
- premikanje pogleda po vecjem svetu.

## Upravljanje

- `Zazeni / Ponastavi` ustvari nov svet z izbranimi nastavitvami.
- Pogled premikate z misko po zemljevidu ali s tipkami `WASD` oziroma smernimi tipkami.
- `Ponastavi pogled` vrne kamero na sredino sveta.

## Zagon

```bash
npm install
npm run dev
```

## Preverjanje

```bash
npm run test
npm run build
```
