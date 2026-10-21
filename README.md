# Urban Footprints

Compare international urban regions on the map of a familiar U.S. metro, preserving geographic scale. Built for Brian Balzar.

## Features

- Select any of the 30 largest U.S. metropolitan areas, ranked using July 2025 Census estimates.
- Search 1,285 international functional regions by city, country, or three-letter country code.
- Add up to eight independently colored overlays; drag them or use keyboard-accessible 2 km positioning buttons.
- Show/hide each region and adjust fill opacity. Center overlays and fit all visible boundaries.
- Compare population, regional area, density, and regional area per resident. Switch between square kilometers and square miles.
- Find international regions with similar populations using the same 2015 population definition as the map.
- Copy a link that retains the base, selected regions, positions, units, opacity, visibility, and map view.
- Export a high-resolution PNG of the current map with a legend, comparison statistics, distance scale, and source notes. Preview the image, then click **Download PNG**.

The default comparison is Dallas–Fort Worth, Madrid, and Xi’an.

## Run locally

Requires Node.js 20 or later. There are no npm dependencies or API keys.

```sh
npm start
```

Open http://localhost:3000. Alternatively, serve `public/` with any static web server. Do not open `index.html` as a `file://` URL: browser modules and geographic-file requests need HTTP.

```sh
npm run check
npm test
```

The automated checks cover spherical transfer at different latitudes, unit conversions, all 30 U.S. mappings, every catalog polygon, and saved comparison validation. The default PNG export, base switching, and international search/add flow were also checked in a browser.

## Host on GitHub Pages

1. In this repository, open **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Choose **main** and **/ (root)**, then save.

The root `index.html` forwards visitors to `public/`, preserving saved comparison links. `.nojekyll` keeps the site static. The same `public/` directory works on Cloudflare Pages, Netlify, or another static host; no build command is required.

Street tiles are provided by OpenStreetMap and require an internet connection. Follow the [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) if deploying at substantial traffic. The app loads boundaries and statistics from its own versioned files. PNG export includes attribution and explicitly identifies missing street tiles.

## Understanding the data

**All map boundaries and comparison statistics are from 2015**, using the European Commission Joint Research Centre / OECD **GHS-FUA R2019A** dataset. Functional urban areas combine urban centers and modeled commuting zones, including rural land. They are neither city administrative boundaries, official U.S. MSAs, nor measurements of built-up land.

The 2025 Census populations select and rank the 30 U.S. choices only. They are intentionally not mixed into the 2015 region statistics. The current ranking population appears separately beneath the selector.

The U.S. crosswalk is explicit in `scripts/build_catalog.py`. Important differences:

- Los Angeles and Riverside map to the same broader Los Angeles functional region.
- San Francisco–Oakland uses the broader region named **San Jose** in the source.
- San Diego uses the **U.S. portion** of the source region named **Tijuana**, not the Mexican Tijuana region.
- Other source regions can also differ substantially from their corresponding Census MSA.

These mappings are disclosed in the interface, comparison table, and export. Comparing total regional area can illustrate settlement patterns, but it does not alone establish transport emissions, developed-land consumption, or environmental performance.

### Scale and alignment

Region centers are area-weighted centroids of exterior polygon rings in the original equal-area Mollweide projection. Every vertex in an international overlay retains its spherical distance and compass bearing from that center when transferred to the selected U.S. region. North stays up. This avoids naive Web Mercator pixel scaling across latitudes. Spherical transplantation can introduce small shape/area differences; it is a visual comparison, not cadastral measurement. Reported areas are the source dataset's areas, not recomputed from moved shapes.

The original source grid is 1 km; displayed boundary vertices are rounded to six decimal places. A large pixel export does not increase the source data’s geographic precision. PNGs render at 2× the current map’s CSS dimensions (capped at 8,192 pixels per side).

### Sources

- [JRC GHS-FUA dataset and download](https://human-settlement.emergency.copernicus.eu/ghs_fua.php)
- [GHSL–OECD functional urban areas methodology](https://publications.jrc.ec.europa.eu/repository/handle/JRC118845)
- [U.S. Census Vintage 2025 metro population tables](https://www.census.gov/data/tables/time-series/demo/popest/2020s-total-metro-and-micro-statistical-areas.html)
- Source files retrieved October 21, 2026.

To rebuild the catalog using Python 3.10+ (standard library only):

```sh
python scripts/build_catalog.py
```

Downloads are cached in ignored `.cache/`. The script reads the original JRC GeoPackage directly; it does not rely on third-party reprojected boundary mirrors. Country-level JSON files load only when needed.

If a future Census release changes the top 30, update and review the crosswalk before rebuilding. Do not silently guess source regions by similar names.

## Project structure

```text
public/                 Static application and versioned geographic data
public/app.js           UI, map layers, search, interaction, and sharing
public/geo.js           Geographic transfer and comparison calculations
public/state.js         Validated comparison URL serialization
public/export.js        PNG rendering and attribution
public/vendor/          Locally vendored Leaflet 1.9.4
scripts/build_catalog.py Reproducible source-data extraction and crosswalk
scripts/serve.mjs       Dependency-free development server
tests/                  Node built-in test runner
```

App code is MIT licensed. Geographic data, Leaflet, and OpenStreetMap retain their own terms; see [THIRD_PARTY.md](THIRD_PARTY.md).
