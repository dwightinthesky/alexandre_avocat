# Alexandre Avocat - Site Vitrine

Static, fast-loading website for a Paris law office.

## Pages

- `index.html` (Accueil)
- `domaines.html` (Domaines d'intervention)
- `honoraires.html` (Honoraires)
- `rendez-vous.html` (Prendre Rendez-vous)
- `mentions-legales.html` (Mentions légales + médiateur)
- `politique-confidentialite.html` (RGPD)

## Local preview

```bash
python3 -m http.server 4173
```

Open: `http://127.0.0.1:4173/index.html`

## Notes before production

- Replace legal placeholders in `mentions-legales.html`:
  - full legal name
  - SIRET
  - hosting provider details
- Replace `Espace Client` and calendaring placeholder URLs.
