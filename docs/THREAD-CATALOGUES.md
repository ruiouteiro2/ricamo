# Local thread catalogues / Cataloghi locali dei fili

## English

Open **Settings → Manage catalogues**. Download the personal JSON template, enter the actual source and usage conditions, then choose the file. Review the swatches and confirm before storing it. Importing a catalogue creates no material, lot, purchase, reservation or consumption. Sources and licences are user declarations; the application does not certify manufacturer data.

Each imported name/version is immutable. To correct colours, import another version. Limits are 5 MiB per JSON file, 6,000 colours per version, 20 imported versions and 20,000 imported colours in total. Brand + range + string code is the commercial identity; identical codes from different brands remain distinct. An empty range is allowed. Numeric codes are rejected, preserving leading zeroes.

In image generation, choose **Catalogue → Catalogue version**. The selected version also appears in the editor's **Add colour** dialog. Inventory-only and inventory-preferred generation retain their existing rules; inventory-preferred still uses the bundled DMC fallback. The bundled MakeBead snapshot remains attributed and approximate, not official manufacturer data. Saved revisions retain actual swatches, identity, version, source, licence and a SHA-256 fingerprint of canonical catalogue data. Updating the catalogue does not rewrite old revisions.

**Compare substitutions** compares a single palette colour with local thread materials using the engine's approximate CIE76 distance. It shows commercial identity, available stock, reservations, units and known filament conversions. Unknown stock and unsupported conversions remain explicit. A close RGB match is not a claim of physical equivalence. Select a material and confirm to change only the draft. Publish a new revision separately; project revision selection, progress and material estimation remain explicit. Blend recipes continue through the component editor; they cannot silently become a single thread through this comparison.

Full backups retain local catalogue versions. Project packages exclude the catalogue collection and its local IDs. They include the attribution/version/fingerprint of palette and recipe references. Unused candidates from a versioned catalogue, fixed/excluded index options and palette preference indices are omitted whenever provenance contains `palette.catalogue`. This includes the bundled DMC version selected in the UI, not only imported versions. Legacy provenance without `catalogue` and the existing DMC/inventory fallback keep their previous package policy. The explicit catalogueProjection metadata records that reproducing generation requires the original catalogue and settings. The retained catalogue digest still identifies the complete original version, not the projected palette. Exporting a catalogue JSON is an explicit operation; check its recorded conditions before redistribution.

## Italiano

Apri **Impostazioni → Gestisci cataloghi**. Scarica il modello JSON personale, indica origine e condizioni reali e scegli il file. Controlla colori e riferimenti, poi conferma. L'importazione non crea materiali o scorte. Nome e versione non possono essere sovrascritti: per correggere dati importa una nuova versione.

Nel generatore scegli **Catalogo → Versione del catalogo**; la scelta è disponibile anche in **Aggiungi colore**. I campioni sono approssimativi. Le revisioni salvate conservano i riferimenti originali anche dopo un aggiornamento. **Confronta sostituzioni** richiede selezione e conferma e modifica soltanto la bozza; salvataggio della revisione, progetto, stima, progresso e riserve restano operazioni separate. Per le miscele usa l'editor dei componenti.

Il backup completo conserva tutti i cataloghi locali. I pacchetti di progetto escludono la raccolta locale e i suoi ID, mantenendo l'attribuzione delle versioni utilizzate. La proiezione ridotta si applica a ogni provenienza con `palette.catalogue`, inclusa la versione DMC incorporata selezionata nell’interfaccia: candidati non usati e indici delle restrizioni/preferenze vengono omessi. Per rigenerare esattamente servono catalogo e impostazioni originali. Provenienze precedenti senza `catalogue` e il ricorso esistente a inventario/DMC mantengono la politica precedente. L'impronta SHA-256 riguarda i dati canonici del catalogo, non la formattazione originale del file.

## JSON format

This is an authored example, not a manufacturer catalogue. Replace its descriptions with your own source and conditions.

```json
{
  "format": "ricamo-thread-catalogue",
  "schemaVersion": 1,
  "catalogue": {
    "name": "My personal colours",
    "version": "1",
    "source": "Describe the actual source",
    "license": "Describe the actual usage conditions",
    "colors": [
      { "brand": "Personal", "range": "", "code": "001", "name": "Example blue", "hex": "#336699" }
    ]
  }
}
```
