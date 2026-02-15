# France Medailles

Tableau de bord des medailles de la France aux Jeux olympiques d'hiver, de Chamonix 1924 a Milan-Cortina 2026.

Site : **[francemedailles.fr](https://francemedailles.fr)**

## Fonctionnalites

- Palmares historique : medailles par edition depuis 1924 (graphique en barres empilees or/argent/bronze)
- Suivi jour par jour : evolution cumulative des medailles pendant les JO en cours
- Comparaison entre editions : courbes superposees des 5 dernieres editions (2010-2026)

## Structure du projet

```
france-medailles/
  data/              # Donnees sources (non incluses, voir ci-dessous)
  scripts/           # Scripts Python de traitement
  output/            # Donnees generees (JSON/CSV) utilisees par le site
  site/              # Site statique (HTML, CSS, JS)
    assets/          # Images
    index.html
    styles.css
    app.js           # Visualisations Chart.js
```

## Lancer le site en local

```bash
python -m http.server 8001
# Ouvrir http://localhost:8001/site/
```

## Sources de donnees

Les fichiers CSV sources dans `data/` proviennent du dataset Kaggle [Olympic History Dataset](https://www.kaggle.com/datasets/piterfm/olympic-games-medals-19862018) (licence CC BY-SA 4.0), base sur les donnees de [Olympedia](https://www.olympedia.org/).

Fichiers attendus dans `data/` :
- `Olympic_Medal_Tally_History.csv`
- `Olympic_Athlete_Event_Details.csv`
- `Olympic_Event_Results.csv`
- `Olympic_Games_Summary.csv`
- `Olympic_Country_Profiles.csv`

## Regenerer les donnees

```bash
# Medailles par edition
python scripts/build_france_winter_medals.py

# Evolution jour par jour (exemple : 2026, filtre France)
python scripts/build_medal_evolution_since_j0_2022.py --country France
```

## Contribuer

### Ajouter une medaille (pendant les JO en cours)

Deux fichiers JSON doivent etre mis a jour :

1. **`output/medal_evolution_since_j0_2026_FRA.json`** : mettre a jour la ligne du jour concerne en incrementant les compteurs `gold`, `silver`, `bronze` et `total`.

```json
{
  "day_index": 4,
  "date": "2026-02-10",
  "gold": 1,
  "silver": 2,
  "bronze": 0,
  "total": 3
}
```

Les valeurs sont **cumulatives** : chaque jour contient le total depuis le debut des JO.

2. **`output/france_winter_medals_by_edition.json`** : mettre a jour l'entree de l'edition en cours avec le nouveau total.

```json
{
  "edition": "2026 Winter Olympics",
  "year": 2026,
  "gold": 5,
  "silver": 3,
  "bronze": 4,
  "total": 12
}
```

### Soumettre une contribution

1. Forker le repo
2. Creer une branche (`git checkout -b ajout-medaille-YYYY-MM-DD`)
3. Modifier les deux fichiers JSON
4. Ouvrir une Pull Request

## Licence

[CC BY-NC 4.0](LICENSE) - Usage commercial interdit sans autorisation.
