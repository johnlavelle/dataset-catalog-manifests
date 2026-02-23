**Subject: Dataset documentation — manifests over Confluence pages**

Hi all,

I missed the recent meeting, but wanted to share some thoughts on the dataset catalog before the approach gets locked in.

**The problem with Confluence-first**

When someone writes a Confluence page for a dataset, that page immediately becomes the source of truth and a dead end. The information is locked in Confluence's HTML: it can't be validated, queried, or reused elsewhere.

It also duplicates what the filesystem already knows. File counts, sizes, compression, variable lists, access times; all of this is already on disk or in Robinhood. Writing it into Confluence by hand is wasted effort, and the page goes stale the moment new data arrives. More practically, we can't programmatically answer questions like "what datasets do we have, how large are they, and when were they last accessed?" Every question requires someone to look it up manually. And since each person documents differently, with different table layouts, different terminology, different levels of detail, comparing datasets or building any kind of overview means reading every page individually.

**A different approach: manifests + automated scanning**

I've built a working prototype. Dataset owners provide a short YAML manifest covering just the things that can't be discovered automatically:

```yaml
dataset:
  name: "BALMFC MYP2022 Univariate SST"
  path: "/net/isilon/ifs/arch/home/iri/BALMFC/Nemo4.0/BALMFCMYP2022_univariateSST"
  model: "NEMO-SI3-PDAF-ERGOM"
  contact: "Ida Margrethe Ringgaard"

products:
  BAL-ERGOM_BGC-DailyMeans:
    name: "Baltic Biogeochemistry Daily"
    dir: "BAL-ERGOM_BGC-DailyMeans"
    category: "Biogeochemistry"
    type: "final product"
    notes: "Chl, nutrients, oxygen, pH"
```

That's a few lines per product. Everything else is pulled automatically: file sizes and counts from Robinhood, which already indexes the entire filesystem; NetCDF metadata via `ncdump`; GRIB metadata via `grib_ls`; and access and modification times from Robinhood. The manifests live in Git, go through merge request review, and are validated by CI before merge.

Tooling: https://gitlab.dmi.dk/jola/data-archiving-info  
Manifests: https://gitlab.dmi.dk/jola/dataset-catalog-manifests

**Write once, publish anywhere**

Once the data is structured, output format is just a template choice. A script can generate formatted documentation from scan results and push it to Confluence, or anywhere else, regenerated periodically so nothing goes stale. The output format stops being a constraint.

Beyond that: STAC catalogs (here's a proof of concept for [BALMFC](https://radiantearth.github.io/stac-browser/#/external/minio.dive.edito.eu/oidc-jola/balmfc-stac/metadata-catalog/catalog.json)), storage audit reports identifying deletion candidates and cold storage opportunities, WIS2 metadata, web dashboards, inventory spreadsheets; all of it is just a new template. The collection work is done once.

Best,  
John