# Ricamo — guida pratica

Per Ricamo 0.4.0. I nomi dei comandi qui riportati corrispondono all’interfaccia italiana. Puoi scegliere **Italiano** dal selettore della lingua o da **Impostazioni → Lingua**. Le finestre native di Windows per file e stampanti possono usare la lingua del sistema. È disponibile anche la [guida in inglese](USER-GUIDE-EN.md).

## Comincia con un lavoro piccolo

L’atelier personale parte vuoto. Per l’uso normale non servono un account o una connessione Internet. In **Impostazioni** scegli valuta e formato carta A4/Letter; potrai modificarli in seguito.

Per fare pratica senza mescolare dati di prova e materiali personali, apri **Guida → Prova l’atelier di esempio**. La finestra separata è contrassegnata **Atelier di esempio**. Segui **Prova questi passaggi**: confronta il cotone rosso misurato con la sua riserva, osserva il cotone oro di quantità sconosciuta, segna il progetto di prova e modifica il piccolo fiore. **Torna al mio atelier** chiude questa finestra. Le modifiche all’esempio non cambiano la tua biblioteca e non entrano nelle sue copie di sicurezza.

Per iniziare con i tuoi dati:

1. Apri **Dove si trova → Nuova posizione** e crea una scatola o un cassetto.
2. In **Materiali → Aggiungi materiale**, inserisci nome, categoria e l’unità che usi realmente per contarlo. Aggiungi marca, gamma e codice quando li conosci: `001` è un codice, diverso da `1`.
3. In **Quello che possiedi**, indica quantità e posizione. Lascia la quantità vuota se non la puoi ancora misurare.
4. In **Progetti → Nuovo progetto**, crea un piccolo lavoro e aggiungi il necessario nella sua scheda **Materiali**.
5. Dopo aver registrato dati utili, crea una copia: **Impostazioni → Copia di sicurezza → Crea una copia**.

Attendi la conferma di salvataggio. Se l’editor segnala modifiche in attesa o un errore, tienilo aperto e usa **Riprova**. Una bozza salvata e una revisione pubblicata dello schema sono due cose diverse.

## Materiali e lotti fisici

Il materiale di catalogo descrive una referenza. I lotti descrivono ciò che possiedi: quantità, lotto di tintura, stato e posizione. **Aggiungi un lotto** serve per un’altra matassina, confezione o pezza della stessa referenza, anche con posizione o tintura diversa. Crea un materiale distinto quando cambiano l’identità o l’unità con cui lo conti.

| Indicazione | Significato |
| --- | --- |
| Quantità fisica | Materiale registrato come posseduto. |
| Utilizzabile | Materiale in condizioni adatte all’uso. |
| Riservato | Impegnato per un progetto, ma ancora presente. |
| Disponibile | Materiale utilizzabile rimasto dopo le riserve. |
| Da verificare | Quantità o conversione ancora sconosciuta. |
| Stimata | Quantità numerica approssimata. |
| 0 | Zero conosciuto, non una quantità da misurare. |

Un lotto utilizzabile ma non misurato può rendere incerta una mancanza. Misuralo prima di considerare un divario come quantità certa da acquistare. Il colore sullo schermo non certifica una corrispondenza esatta con una cartella del produttore.

Apri il materiale e usa **Registra un movimento** per entrata, consumo confermato, perdita, scarto, reso, conteggio fisico o spostamento. Nel **Conteggio fisico** inserisci la nuova quantità effettivamente contata, non quanto aggiungere. Se il conteggio entra in conflitto con riserve esistenti, controlla quelle riserve. Per cambiare posizione usa **Sposta**: non registrare una seconda entrata dello stesso materiale.

**Inserimento rapido**, **Modifica selezionati**, categorie e viste salvate aiutano con inventari grandi. Leggi le anteprime prima di applicare modifiche a più materiali. Le etichette esportate aiutano a identificare materiali e posizioni. L’importazione CSV da **Impostazioni** include un’anteprima; [Formati dei dati](DATA-FORMATS.md) descrive colonne e formati supportati.

Un metro di filo completo e un metro di un singolo filamento sono quantità diverse. Lunghezza della confezione e numero di filamenti devono descrivere il prodotto reale. Ricamo non presume che ogni matassina contenga 8 m o che ogni filo abbia sei filamenti separabili. Consulta [Materiali e unità](MATERIALS.md).

Per una conta parziale apri **Materiali → Inventario fisico** e filtra materiali, categoria o posizione. Compila solo i lotti contati: una **Quantità osservata** vuota lascia il lotto invariato; `0` registra uno zero reale. Controlla differenze e riserve per progetto. Scegli se mantenere la mancanza visibile oppure redistribuire le riserve, poi usa **Conferma conta e decisioni**. L’anteprima mostra anche gli eventuali fabbisogni minimi creati alla conferma; quelli già pianificati restano conservati.

Durante l’importazione CSV, **Modelli CSV vuoti** scarica le intestazioni per fogli italiani o inglesi. Inserisci i tuoi dati e mantieni i codici come testo. Il modello italiano usa punto e virgola e decimali con virgola; quello inglese usa virgole e decimali con punto.

Usa **Foto e documenti del luogo** per conservare una fotografia o un documento con una posizione. I file selezionati restano in attesa fino a Salva; annullare il modulo non li collega.

## Cataloghi locali e sostituzioni dei fili

In **Impostazioni → Cataloghi locali dei fili → Gestisci cataloghi**, usa **Modello JSON personale** per vedere il formato, poi **Importa catalogo JSON**. Controlla origine dichiarata, licenza/condizioni, versione e colori. Conferma il diritto di usare localmente i dati prima di **Conserva questa versione**. L’importazione non crea materiali d’inventario o lotti posseduti. Le versioni sono immutabili: per correggere dati importa una nuova versione. Limiti: 5 MiB per file JSON, 6000 colori per versione, 20 versioni importate e 20000 colori totali. Conserva i codici come testo.

Scegli **Versione del catalogo** nella generazione con catalogo o in **Aggiungi colore**. Le revisioni conservano versione e attribuzione; importare un aggiornamento non le ricolora. **Preferisci i colori del mio inventario** mantiene il ricorso al DMC già disponibile. I campioni RGB forniti o importati sono approssimativi, non garantiscono equivalenze ufficiali.

Nell’editor scegli un colore a filo singolo e apri **Confronta sostituzioni**. Controlla identità commerciale, distanza approssimativa ΔE76, quantità fisica/disponibile, riserve, unità e conversioni sconosciute. La somiglianza RGB non prova l’intercambiabilità di fibra, finitura o colore. La conferma cambia solo la voce della tavolozza nella bozza. Pubblica una revisione, verifica il cambio nel progetto e ricalcola separatamente il fabbisogno. Per le miscele resta l’editor delle ricette.

## Riserva, ricama e registra il consumo reale

Nella scheda **Materiali** del progetto, **Aggiungi materiale necessario** registra la quantità prevista. Con **Riserva** scegli un lotto reale e la quantità totale da destinare a quel progetto. Zero libera la riserva.

Per esempio: con 24 m fisici e riserve di 10 m e 8 m, restano 6 m liberi. Consumando 4 m per il primo progetto, rimangono 20 m fisici e 6 m ancora riservati a quel progetto: i metri liberi restano 6. Non sottrarre il consumo una seconda volta come riserva.

Usa **Consumo confermato** solo per materiale realmente utilizzato. Segnare punti, registrare tempo o concludere un progetto non inventa consumo. Una quantità sconosciuta richiede un conteggio prima di un movimento quantitativo. Telai e strumenti riutilizzabili si assegnano o si riservano, poi si restituiscono: non sono consumo di filo. **Prestiti e manutenzione** gestisce questi eventi separatamente.

## Tessuti e kit

Per un tessuto indica le dimensioni reali della pezza e se la contatura esprime punti per pollice oppure fili del tessuto per pollice. Ricamare su due fili cambia la densità effettiva. In **Pezza, riserve e tagli**, usa **Simula e riserva** per verificare misure, orientamento, margini e regioni già impegnate. L’area non basta: un quadrato necessario di 31,4 × 31,4 cm non entra in una pezza di 30 × 40 cm.

La calcolatrice e il rapporto mostrano separatamente **Griglia completa** ed **Estensione ricamata**. Quest’ultima segue punti interi, mezzi punti ed estremi del punto scritto; le celle vuote non la allargano. Continua a pianificare il taglio dalla griglia completa e dai quattro margini. Una contatura sconosciuta lascia sconosciuti i centimetri. Uno schema vuoto non ha estensione ricamata; un punto scritto verticale può avere larghezza geometrica zero, perché lo spessore del filo è escluso.

In **Misure e condizioni → Geometria misurata**, inserisci rettangoli o poligoni semplici per le aree inutilizzabili, in centimetri; per una pezza irregolare registra anche il contorno. Inserisci i vertici in ordine lungo il bordo, una coppia X Y per riga. Sono ammessi 16 difetti e 24 vertici per poligono, con sei decimali. Incroci e nuove forme fuori dalla pezza vengono rifiutati. Conferma la mappatura completa solo dopo aver misurato tutte le limitazioni; le fotografie non vengono misurate automaticamente.

L’area utile calcolata esclude margini e unione dei difetti, contando le sovrapposizioni una sola volta. L’area non prenotata esclude anche regioni o pezze interamente riservate. Note precedenti o contorni incompleti lasciano l’area sconosciuta; una pezza interamente inutilizzabile può avere area zero conosciuta. **PDF della geometria misurata** esporta misure e identità locale senza note descrittive private. Il diagramma non è un modello di taglio in scala fisica.

Tagli e regioni riservate al taglio non possono attraversare un difetto registrato, il contorno o un margine inutilizzabile, nemmeno con conferma manuale. La ricerca limitata di posizioni può proporre un incastro verificato; l’assenza di proposte richiede una verifica manuale e non dimostra l’impossibilità di ogni posizione. I ritagli rettangolari conservano le forme originali e il loro riferimento geometrico. Il taglio fisico di contorni irregolari arbitrari resta manuale.

Usa **Conferma taglio effettuato** solo dopo il taglio reale. Ricamo registra il pezzo ottenuto e i ritagli mantenendone l’origine; riservare una regione non taglia il tessuto. L’annullamento può essere rifiutato quando operazioni successive dipendono dai pezzi ottenuti.

Le **Collezioni virtuali** sono liste riutilizzabili per **Prepara i materiali del progetto**. Non creano scorte fisiche. Controlla se mantenere le necessità già presenti o sostituirne le quantità prima di applicare una lista.

Un kit fisico è diverso. Registra il **Contenuto dichiarato del kit**, poi usa **Apri e verifica kit** su un lotto del kit. Identifica ciò che hai realmente trovato, le quantità e le eventuali sostituzioni. Un componente trovato ma non misurato può avere quantità sconosciuta. Le voci mancanti o non verificate non diventano scorte utilizzabili. **Verifica i componenti in sospeso** registra controlli successivi senza aprire un altro kit. L’apertura rimuove un kit integro e registra i componenti verificati: non consumare di nuovo la stessa unità del kit. Il **Costo comune non ripartito** resta separato e non viene sommato automaticamente una seconda volta al costo dei componenti consumati.

## Acquisti

**Acquisti → Fabbisogno dei progetti** combina le necessità condivise senza contare la stessa scorta per ogni progetto. **Aggiorna lista dalle mancanze** crea o aggiorna divari quantificati; quantità incerte richiedono verifica, non un ordine inventato.

Usa **Aggiungi acquisto** per una voce manuale o un ordine. Ordinato non significa ricevuto. All’arrivo usa **Registra arrivo**, inserisci solo la quantità di quella consegna e scegli la destinazione. Puoi registrare più consegne parziali sullo stesso ordine. Prima del prossimo arrivo controlla ciò che resta in attesa. Costi in valute diverse restano separati: non viene applicato automaticamente un cambio.

Usa **Fatture e ricevute** per i documenti dell’acquisto e **Documenti della ricezione** per una consegna specifica. Salva i file selezionati per collegarne le copie gestite. Allegare una fattura registra un documento; le quantità consegnate si registrano separatamente con **Registra arrivo**.

## Progetti, tempo e finiture

Un progetto può usare una revisione salvata, un PDF/immagine di riferimento oppure nessuno schema strutturato. La revisione fissata non cambia quando nella biblioteca ne salvi una nuova. Usa **Modifica → Usa l’ultima revisione dello schema** solo se intendi cambiarla. **Verifica il cambio di revisione** confronta dimensioni della griglia e del ricamo, materiali, stime, fabbisogni salvati, riserve, consumi e progresso. I PDF già esportati non cambiano: rigenerali con le opzioni desiderate. La verifica non inventa il numero di pagine di un futuro PDF.

Il progresso della nuova revisione riparte da zero per impostazione predefinita. **Trasferisci solo i punti con corrispondenza dimostrata** è una scelta esplicita: nello stesso schema e riferimento di tessuto/pianificazione devono coincidere coordinate, tipo/direzione, filo o ricetta identificati e filamenti. Non deduce traslazioni, non trasferisce riferimenti anonimi/ambigui e non converte percentuali manuali in punti. Il progresso precedente e le stime restano nello storico; i fabbisogni derivati vengono invalidati, quelli manuali e le riserve fisiche restano da verificare. Se la biblioteca cambia mentre la verifica è aperta, aggiornala prima di confermare.

Organizza i passaggi in **Preparazione e finiture**. **Salva come modello**, **Applica modello** e **Gestisci modelli di checklist** permettono di riutilizzare liste. Puoi copiare e personalizzare i modelli inclusi. La sostituzione dei passaggi non completati richiede un’anteprima; quelli completati vengono mantenuti. Eliminare un modello non elimina i passaggi già applicati ai progetti.

In **Ricama**, usa **Avvia cronometro**, **Pausa** e **Salva sessione**. Verifica la durata, soprattutto dopo la sospensione del computer. Puoi anche usare **Diario → Registra una sessione**. Registrare il tempo non segna punti e non consuma materiale.

In **Previsione del tempo → Imposta previsione**, scegli:

- **Previsione da sessioni misurate**: la velocità deriva da sessioni compatibili con durata e lavoro contato sulla revisione fissata. Le altre sessioni restano nel diario.
- **Previsione manuale: ipotesi personali**: indica il tempo per punto croce, mezzo punto e segmento di punto scritto. Per un progetto senza griglia inserisci anche le quantità restanti. Usa 0 per un tipo assente e lascia vuoto solo ciò che non conosci.

Il lavoro restante di una griglia deriva dal progresso reale. Una percentuale non viene trasformata in un conteggio immaginario di punti. Se manca un tempo o un conteggio necessario, il totale resta sconosciuto. Ore settimanali disponibili e minuti aggiuntivi di finitura influenzano la previsione; la data è una stima di pianificazione, non una promessa.

**Calcola i fili necessari** permette di verificare le ipotesi e collegare colori o componenti di una miscela ai materiali reali del catalogo. Controlla quantità e conversioni sconosciute prima di applicare il risultato. **Confronta con il consumo confermato** può calibrare la stima di un materiale il cui lavoro è terminato, quando consumo e revisione consentono un confronto attendibile. Una miscela usa numeri interi di filamenti dei componenti; non crea automaticamente una nuova scorta fisica di filo mescolato.

Prima di **Concludi progetto**, registra il consumo reale e controlla necessità, strumenti e finiture. La chiusura libera le riserve e restituisce gli strumenti del progetto. Riaprire permette altro lavoro senza cancellare lo storico precedente.

## Seguire uno schema strutturato

Nella scheda **Ricama** usa gli strumenti di marcatura, il colore evidenziato e **Tipo di punto da marcare**. **Lavoro restante per colore** mostra completati/totale separatamente per punti croce, mezzi punti e segmenti di punto scritto. Il tessuto vuoto è escluso. I filtri cambiano ciò che segni, mai il totale globale. Prima di segnare una selezione con più punti, controlla l’anteprima.

Metti a fuoco la tela per usare frecce e Spazio; **Annulla modifica** e **Ripeti modifica** correggono la sessione corrente. **Colonna**, **Riga** e **Vai alle coordinate** portano a una posizione precisa. Puoi cercare marca, codice, nome o simbolo nella tavolozza.

**Segna dove continuare** registra dove riprendere; **Annota un filo parcheggiato** identifica anche il colore del filo. Con la tela a fuoco, B e P aprono questi moduli. Sono riferimenti, non punti completati o movimenti di scorta. Appartengono al progetto e alla revisione. I riferimenti vecchi o non assegnati restano leggibili ed eliminabili; un vecchio segnaposto non assegnato richiede un’associazione esplicita prima di navigare nella revisione attuale. Cambiare revisione non riutilizza silenziosamente le coordinate precedenti. Posizione e contesto vengono salvati cambiando scheda, navigando e chiudendo; riprova se la scrittura fallisce.

Senza griglia strutturata usa **Progresso manuale (%)**. Le annotazioni su un PDF non costituiscono un conteggio esatto dei punti.

## Generare, modificare e conservare riferimenti

Apri **Dettagli → Modifica dettagli dello schema** per indicare autore, tecnica, tema, origine, difficoltà personale e annotazioni sui diritti. Le **Collezioni** raggruppano gli schemi senza copiare i file; preferiti e filtri aiutano a ritrovarli. **Utilizzo nei progetti** distingue collegamenti attuali e revisioni storiche. Nel pacchetto condiviso viaggiano autore, tecnica, tema e diritti annotati; origine, difficoltà personale e collezioni richiedono la scelta di includere note private. Le annotazioni sui diritti non concedono una licenza.

In **Schemi** scegli **Da un’immagine**, **Griglia vuota**, **Importa schema** o **Importa riferimento**. La generazione accetta PNG, JPEG, WebP e GIF entro i limiti di file e dimensioni; un’immagine animata non diventa uno schema animato.

Ritaglia, ruota/rifletti e regola luminosità e contrasto prima di scegliere dimensioni e limite di colori. La griglia supporta fino a 500 × 500 celle e 80 colori; le modalità semplificata e bilanciata possono usarne meno. L’immagine originale resta distinta dal risultato modificabile.

**Trattamento della trasparenza** permette celle vuote oppure composizione sul bianco/su un colore. La composizione rende punti anche le aree prima trasparenti. **Rimuovi il fondo collegato ai bordi** crea invece una maschera dei colori collegati al bordo dell’immagine attraverso pixel corrispondenti o trasparenti, usando quattro vicini. Scegli **Colore del fondo** e **Tolleranza del colore di fondo** (0–80 ΔE76 approssimativo). I bianchi completamente racchiusi da pixel mantenuti restano ricamati. È una maschera cromatica sulla griglia ridimensionata, non un riconoscimento semantico del soggetto. Controlla l’anteprima aggiornata dopo aver cambiato dimensioni; se tutto viene rimosso, la generazione segnala immagine vuota e non salva un nuovo risultato vuoto. Il file originale resta invariato. In **Colori fissati o esclusi**, cerca nella tavolozza e scegli i riferimenti da mantenere o escludere. Un colore fissato occupa un posto anche se nessun punto lo usa. Se cambia la tavolozza disponibile, controlla le restrizioni azzerate e sceglile di nuovo. Confronta le anteprime precedente e attuale: Salva conserva solo il risultato attuale.

**Solo colori del mio inventario** limita la scelta ai colori dei fili posseduti e utilizzabili. **Preferisci i colori del mio inventario** consente una preferenza entro una distanza cromatica limitata, con ricorso al catalogo quando necessario. Entrambe possono considerare materiale riservato o non misurato: nessuna garantisce che la quantità sia sufficiente. Controllala nei materiali del progetto.

Verifica **Revisione dei dettagli**, piccole regioni e zone protette prima di salvare. La pulizia può rimuovere dettagli significativi; le zone protette limitano quella pulizia, non ogni trasformazione dell’immagine. I colori restano approssimati. Puoi annullare la generazione; un’anteprima non salvata non diventa uno schema in biblioteca.

L’editor offre punti croce, mezzi punti, punto scritto, selezione/copia/incolla, trasformazioni e **Motivi e testo**. Il testo usa l’alfabeto a punti supportato: non converte qualsiasi carattere tipografico. Un ridimensionamento che elimina punti mostra il suo effetto. **Salva nuova revisione** pubblica una revisione senza cambiare i progetti fissati a un’altra.

**Colonna**, **Riga** e **Vai alle coordinate** funzionano anche nell’editor del disegno, con posizioni che iniziano da 1. **Vai al centro** porta al centro geometrico e attiva **Mostra il centro**; in una griglia pari il centro è tra le celle. Navigazione e guida non modificano punti o scorte.

Quando salvi o modifichi un motivo personale, **Categoria del motivo** è facoltativa. Riutilizza lo stesso nome per raggruppare i motivi e filtra con **Categoria dei motivi personali**.

Una bozza salvata automaticamente può essere ripresa con **Riprendi bozza** o eliminata esplicitamente. L’esportazione nativa usa la revisione salvata: pubblica la bozza desiderata prima di condividere quel file modificabile. PDF e PNG usano invece il contenuto attuale dell’editor.

Un PDF o un’immagine importato come riferimento resta un documento. Sfoglia le pagine, usa **Evidenzia regione**, **Nota sul documento** e **Segna questa pagina**, poi **Esporta con annotazioni** se serve. **Salva una copia del riferimento** conserva l’originale. Le password dei PDF non vengono memorizzate. Evidenziare una regione non ne ricava punti modificabili o consumo di filo.

**Importa riferimento** accetta una selezione controllata di massimo 20 PDF/immagini, 100 MiB totali e 25 MiB per file. Decidi esplicitamente come trattare i duplicati, poi conferma. Ogni originale/riferimento viene salvato atomicamente; interrompere conserva gli elementi completati. Il resoconto distingue salvati, falliti e da importare. Dopo la riapertura, riseleziona gli stessi originali mancanti per riprovare: il resoconto non conserva i loro byte.

Nei dettagli dello schema o nella panoramica del progetto, usa **Libri e riviste collegati → Collega riferimento** per scegliere un titolo del catalogo e le **Pagine pertinenti**. Puoi collegare un titolo anche senza possederne una copia fisica. La sua scheda materiale mostra **Schemi e progetti collegati**. Sono collegamenti bibliografici locali: non creano scansioni, scorte o necessità. Il backup completo li conserva; i pacchetti di progetto li escludono sempre, anche includendo le note private.

## Esportare e stampare

Per le etichette dei progetti apri **Etichetta del progetto** nell’area dei rapporti; non serve uno schema. Le etichette di materiali, lotti, ritagli e contenitori condividono dimensioni fisse e anteprima A4/Letter. Scegli larghezza 30–180 mm e altezza 20–250 mm. Testo completo e ID reali vengono conservati: se non entrano in modo leggibile, aumenta le dimensioni prima di esportare. Puoi salvare il PDF senza stampante e poi stampare in dimensione reale quando conta la geometria.

**Esporta** nell’editor offre PDF di lettura, PNG e file nativo dello schema. Il PDF include legenda, mappa delle pagine e fasce di sovrapposizione; i punti ripetuti in queste fasce non aumentano il fabbisogno. È ingrandito per la lettura, non un trasferimento a grandezza reale.

Per il PDF da lettura scegli **Orientamento** e **Margini (mm)**, oltre al formato A4/Letter. Sono ammessi margini di 5–40 mm. Questi controlli riguardano il diagramma da lettura; usa **PDF a grandezza reale** per un trasferimento fisico.

Il **Rapporto PDF** del progetto richiede scelte esplicite per destinatario e note private. **PDF a grandezza reale** richiede contature X/Y e significato della contatura corretti. Comincia con **PDF di calibrazione**: stampa al 100%/Dimensioni effettive senza adattamento alla pagina, misura entrambi gli assi e usa **Calcola correzione di stampa** se necessario. Ricamo non può garantire la calibrazione della stampante. Puoi salvare un PDF anche senza stampante; apri il file nel tuo lettore PDF per stamparlo.

Annullare la scelta della destinazione annulla quell’esportazione: non significa che il file sia stato salvato. Puoi riprovare conservando le opzioni.

## Copie, trasferimenti e recupero

**Crea una copia** salva l’intera biblioteca personale, inclusi originali gestiti e bozze. **Copie automatiche** permette di scegliere intervallo, numero di copie e **Scegli seconda cartella**. **Crea copia adesso** mostra l’esito delle destinazioni. Un errore della seconda cartella non invalida una copia locale riuscita. Copie sullo stesso disco non proteggono dalla perdita di quel disco.

**Ripristina una copia** sostituisce la biblioteca attuale dopo un’anteprima; non fonde due inventari. Prima Ricamo conserva una copia dello stato precedente. Mantieni una copia separata e verificata prima di cambiare computer o versione dell’applicazione. I backup non sono cifrati: conservali e condividili tenendo conto del loro contenuto.

Prima delle scritture grandi di backup/ripristino, l’applicazione desktop controlla lo spazio disponibile. Se il controllo o la scrittura fallisce, leggi l’errore, libera spazio e riprova (per una copia esportata puoi scegliere un’altra destinazione); un’operazione fallita non significa che la copia sia stata salvata.

**Esporta progetto** e **Importa progetto** trasferiscono dati del progetto, revisioni supportate e allegati scelti. Controlla privacy e corrispondenze del catalogo. L’importazione non crea scorte fisiche, riserve o arrivi di acquisti. Una nuova copia da ricamare azzera il progresso trasferito e le quantità manuali restanti. Non equivale al ripristino dell’intera biblioteca.

Un pacchetto di progetto non contiene la raccolta dei cataloghi importati o i loro ID locali. Per una revisione generata da un catalogo versionato, inclusa la versione DMC incorporata selezionata nell’interfaccia, conserva attribuzione e referenze presenti nella tavolozza/ricette esportate, ma omette restrizioni sui candidati e indici di preferenza originali. Il pacchetto dichiara che la rigenerazione esatta richiede catalogo e impostazioni originali. Le revisioni precedenti senza provenienza di una versione del catalogo e il ricorso esistente a inventario/DMC conservano il comportamento di esportazione precedente. Origine/licenza dichiarate viaggiano come attribuzione senza oscuramento: controllale prima di condividere. Il backup completo conserva tutta la raccolta locale.

Le esportazioni CSV/TSV/JSON servono per consultazione e analisi. Non sono backup completi e includono nomi/note registrati. [Formati dei dati](DATA-FORMATS.md) descrive i limiti precisi.

Per un rapporto di assistenza apri **Impostazioni → Diagnostica senza dati personali**. Controlla **Anteprima del file diagnostico** prima di esportare. Contiene versione, conteggi e risultato della verifica interna, senza nomi, note, codici, percorsi o allegati. Non viene inviato automaticamente.

## Installazione e limiti verificati

La destinazione prevista è Windows x64 con installatore locale. I pacchetti di sviluppo non sono firmati: non attestano un editore verificato. Non disattivare le protezioni di Windows per installarli. Durante lo sviluppo sono stati verificati un’installazione locale su Windows 10 x64 build 19045 e alcuni percorsi nativi. Questo non certifica l’ultima build su un PC Windows 11 pulito, ogni stampante o ogni file importato. Consulta lo [stato dell’implementazione](STATUS.md) per l’identità del pacchetto verificato e i controlli ancora necessari.

Il pacchetto Windows 0.4.0 ha superato la verifica dei contenuti, 28 percorsi nativi, aggiornamento, reinstallazione e disinstallazione con conservazione dei dati su Windows 10 x64. Sono passati 438 test integrati. [STATUS](STATUS.md) riporta hash, prestazioni misurate e limiti degli ambienti verificati. Il precedente installatore 0.3 resta isolato perché conteneva file e cache aggiuntivi.

## Glossario breve italiano–inglese

| Italiano | English | Significato in Ricamo |
| --- | --- | --- |
| Materiale / referenza | Material / reference | Identità del prodotto, distinta dalle scorte. |
| Lotto | Lot | Quantità fisica con stato, posizione ed eventuale tintura. |
| Riserva | Reservation | Quantità destinata a un progetto; non è un consumo. |
| Consumo confermato | Confirmed consumption | Materiale realmente utilizzato e registrato esplicitamente. |
| Pezza / ritaglio | Fabric piece / remnant | Tessuto originale o parte restante con la sua origine. |
| Filamento | Strand / filament | Singolo componente separato; non sempre l’intero filo. |
| Contatura | Fabric count | Punti o fili del tessuto per pollice, secondo il dato registrato. |
| Bozza / revisione | Draft / revision | Lavoro recuperabile oppure schema pubblicato immutabile. |
| Punto scritto | Backstitch | Segmenti espliciti, contati separatamente dai punti croce. |
| Da verificare | Unknown | Valore non stabilito, distinto dallo zero numerico. |
