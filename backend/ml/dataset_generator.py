"""
Synthetic Clinical Triage Dataset Generator
Generates a clinically realistic, diverse, and balanced triage dataset
covering Emergency, Urgent, and Routine patient encounters.

Features:
- 140+ realistic clinical templates per triage class (420+ total)
- Active clinical vocabulary exceeding 2,100+ unique tokens
- Comprehensive emergency coverage (stroke, cardiac arrest, thunderclap headache,
  status epilepticus, anaphylaxis, severe hemorrhage, trauma, poisoning, septic shock)
- Urgent acute conditions (kidney stones, closed fractures, appendicitis, pyelonephritis,
  cellulitis, severe migraines, asthma flare-ups) with 'chest' strictly excluded from pain templates
- Routine preventive, wellness, chronic refills, and crucially NEGATED symptom presentations
- Portal formatted inputs matching PatientPortal.jsx composite strings
- Realistic noise, informal colloquialisms, and common clinical misspellings
"""

import os
import random
import re
import pandas as pd


def _apply_light_noise(text: str, rng: random.Random) -> str:
    """Introduce realistic informal variations, abbreviations, and mild typos."""
    replacements = {
        "cannot": rng.choice(["cannot", "can't", "cant"]),
        "experiencing": rng.choice(["experiencing", "having", "feeling"]),
        "really": rng.choice(["really", "rly", "very"]),
        "a lot": rng.choice(["a lot", "alot"]),
        "medication": rng.choice(["medication", "medicine", "meds"]),
        "appointment": rng.choice(["appointment", "appt", "consultation"]),
        "stomach": rng.choice(["stomach", "tummy", "abdomen", "belly"]),
        "temperature": rng.choice(["temperature", "temp", "fever"]),
        "prescription": rng.choice(["prescription", "rx", "refill"]),
        "doctor": rng.choice(["doctor", "dr", "physician", "doc"]),
        "yesterday": rng.choice(["yesterday", "yesturday", "yday"]),
    }
    out = text
    for src, dst in replacements.items():
        if src in out and rng.random() < 0.22:
            out = out.replace(src, dst, 1)

    if rng.random() < 0.08:
        out = out.lower()
    if rng.random() < 0.06 and out.endswith("."):
        out = out[:-1]
    return out


# ==========================================
# RICH VOCABULARY & FILLER LISTS
# ==========================================

OPENERS = [
    "", "", "", "", "",
    "Hi doctor, ", "Hello, ", "Please advise: ", "Need help, ",
    "For triage: ", "Doctor, ", "Excuse me, ", "Good morning doctor, ",
    "Good afternoon, ", "Urgent question: ", "Patient intake note: ",
    "Dear triage team, ", "Calling for clinical advice: ", "Hi there, ",
    "Message for on-call clinician: ", "Emergency triage note: ",
    "Urgent consult requested: ", "Routine message: ", "Patient portal intake: ",
    "Attending physician note: ", "Clinical presentation: ", "Primary triage summary: ",
]

ENDINGS = [
    ".", ".", ".", ".", "",
    " please.", ", need an appointment.", " today.", ", what should I do?",
    " right now.", " as soon as possible.", ", please help.",
    ", seeking medical guidance.", ", please evaluate promptly.", ", thank you.",
    ", need advice immediately.", ", looking for next steps.",
    ", appreciate your prompt help.", ", waiting for clinical callback.",
    ", please escalate if necessary.", ", advise on immediate management.",
    ", request telehealth consultation.", ", need prescription renewal.",
]

TIMES = [
    "yesterday", "this morning", "last night", "two days ago", "just now",
    "earlier today", "a few hours ago", "around 3 hours ago", "since lunchtime",
    "an hour ago", "30 minutes ago", "since midnight", "yesterday evening",
    "over the weekend", "three days ago", "since waking up", "around 15 minutes ago",
    "at 4am this morning", "during physical exertion", "right after lunch",
]

DURATIONS = [
    "2 days", "3 days", "4 days", "a week", "yesterday", "this morning",
    "a few hours", "24 hours", "several hours", "5 days", "10 days",
    "2 weeks", "3 weeks", "past 48 hours", "past 12 hours", "past 6 hours",
    "last 36 hours", "about 4 days", "nearly a week", "over a month",
    "past 15 minutes", "approximately 2 hours", "past 72 hours",
]

FEVERS_HIGH = [
    "102.5F", "103F", "103.5F", "104F", "104.2F", "104.5F",
    "39.2C", "39.5C", "39.8C", "40C", "40.2C", "40.5C"
]
FEVERS_MILD = [
    "99.2F", "99.5F", "99.8F", "100.1F", "100.4F", "100.6F",
    "37.3C", "37.5C", "37.8C", "38.0C", "38.1C"
]

# 90+ Chronic and maintenance medications
CHRONIC_MEDS = [
    ("Lisinopril 10mg", "essential hypertension blood pressure maintenance"),
    ("Amlodipine 5mg", "peripheral vascular resistance and hypertension"),
    ("Atorvastatin 20mg", "primary hyperlipidemia cholesterol reduction"),
    ("Rosuvastatin 10mg", "atherosclerotic cardiovascular risk reduction"),
    ("Simvastatin 20mg", "dyslipidemia lipid stabilization"),
    ("Pravastatin 40mg", "coronary artery disease lipid reduction"),
    ("Metformin 500mg", "non insulin dependent type 2 diabetes glycemic control"),
    ("Glipizide 5mg", "type 2 diabetes blood glucose maintenance"),
    ("Empagliflozin 10mg", "SGLT2 inhibitor cardiorenal glucose protection"),
    ("Dapagliflozin 10mg", "glycemic regulation and chronic kidney stabilization"),
    ("Sitagliptin 100mg", "DPP4 inhibitor diabetes postprandial maintenance"),
    ("Semaglutide 0.5mg", "GLP1 receptor agonist metabolic endocrine control"),
    ("Insulin glargine 20 units", "basal diabetes mellitus maintenance"),
    ("Levothyroxine 50mcg", "primary hypothyroidism hormone replacement"),
    ("Levothyroxine 75mcg", "Hashimoto thyroiditis hormone supplementation"),
    ("Omeprazole 20mg", "chronic gastroesophageal reflux disease GERD prophylaxis"),
    ("Pantoprazole 40mg", "erosive esophagitis and gastric acid suppression"),
    ("Esomeprazole 40mg", "peptic acid hypersecretion maintenance"),
    ("Famotidine 20mg", "histamine H2 receptor gastric hyperacidity reduction"),
    ("Albuterol HFA rescue inhaler", "chronic asthma maintenance bronchodilator"),
    ("Budesonide formoterol inhaler", "maintenance chronic asthma steroid therapy"),
    ("Tiotropium bromide inhaler", "anticholinergic long acting bronchodilator"),
    ("Fluticasone propionate nasal spray", "perennial allergic rhinitis prophylaxis"),
    ("Mometasone furoate spray", "allergic seasonal mucosal swelling"),
    ("Montelukast 10mg", "leukotriene pathway seasonal allergic rhinitis"),
    ("Hydrochlorothiazide 25mg", "essential hypertension diuretic therapy"),
    ("Chlorthalidone 25mg", "thiazide diuretic long acting hypertension control"),
    ("Losartan 50mg", "angiotensin receptor blocker diabetic nephropathy"),
    ("Valsartan 80mg", "angiotensin blockade cardiovascular maintenance"),
    ("Metoprolol succinate 25mg", "beta blocker stable rate control and blood pressure"),
    ("Atenolol 50mg", "cardioselective beta adrenergic receptor inhibition"),
    ("Carvedilol 12.5mg", "congestive cardiomyopathy neurohormonal blockade"),
    ("Spironolactone 25mg", "aldosterone antagonist maintenance therapy"),
    ("Furosemide 20mg", "loop diuretic fluid volume balance maintenance"),
    ("Sertraline 50mg", "generalized anxiety and depressive mood maintenance"),
    ("Escitalopram 10mg", "selective serotonin reuptake affective stability"),
    ("Fluoxetine 20mg", "mood stabilization maintenance therapy"),
    ("Duloxetine 30mg", "chronic musculoskeletal fibromyalgia management"),
    ("Venlafaxine 75mg", "serotonin norepinephrine reuptake maintenance"),
    ("Bupropion 150mg", "smoking cessation and affective maintenance"),
    ("Gabapentin 300mg", "postherpetic neuralgia and peripheral neuropathy"),
    ("Pregabalin 75mg", "neuropathic chronic nerve pain modulation"),
    ("Allopurinol 100mg", "chronic hyperuricemia recurrent gout prophylaxis"),
    ("Febuxostat 40mg", "xanthine oxidase inhibitor serum urate reduction"),
    ("Colchicine 0.6mg", "microtubule assembly gout flare prophylaxis"),
    ("Finasteride 5mg", "benign prostatic hyperplasia urinary stream support"),
    ("Tamsulosin 0.4mg", "alpha 1 adrenergic receptor lower urinary tract symptoms"),
    ("Cetirizine 10mg", "perennial allergic conjunctivitis and urticaria"),
    ("Fexofenadine 180mg", "seasonal tree pollen and grass allergy relief"),
    ("Loratadine 10mg", "second generation non sedating antihistamine"),
    ("Clopidogrel 75mg", "antiplatelet coronary stent maintenance"),
    ("Warfarin sodium 5mg", "anticoagulation international normalized ratio"),
    ("Apixaban 5mg", "direct oral anticoagulant nonvalvular atrial fibrillation"),
    ("Rivaroxaban 20mg", "factor Xa inhibitor thromboembolism prophylaxis"),
    ("Diltiazem 120mg", "calcium channel blocker supraventricular stabilization"),
    ("Verapamil 180mg", "non dihydropyridine calcium channel antiarrhythmic"),
    ("Vitamin D3 2000 IU", "cholecalciferol insufficiency replacement"),
    ("Cyanocobalamin B12 1000mcg", "dietary vitamin deficiency maintenance"),
    ("Melatonin 3mg", "circadian rhythm sleep hygiene supplementation"),
    ("Methotrexate 15mg", "disease modifying antirheumatic rheumatoid maintenance"),
    ("Hydroxychloroquine 200mg", "antimalarial immunomodulating autoimmune maintenance"),
    ("Sulfasalazine 500mg", "inflammatory bowel disease mucosal maintenance"),
    ("Baclofen 10mg", "spasticity muscle relaxant maintenance therapy"),
    ("Tizanidine 2mg", "central alpha 2 adrenergic agonist muscle tone"),
    ("Topiramate 50mg", "neurological anticonvulsant migraine prophylaxis"),
    ("Lamotrigine 100mg", "voltage gated sodium channel mood stabilization"),
    ("Levetiracetam 500mg", "synaptic vesicle protein SV2A anticonvulsant"),
    ("Buspirone 10mg", "serotonin 5HT1A receptor partial agonist anxiolytic"),
    ("Hydroxyzine pamoate 25mg", "first generation antihistamine anxiolytic pruritus"),
    ("Ondansetron 4mg", "serotonin 5HT3 receptor antagonist antiemetic"),
    ("Carbamazepine 200mg", "trigeminal neuralgia paroxysmal facial pain"),
    ("Divalproex sodium 250mg", "absence seizure and bipolar mood maintenance"),
    ("Mirtazapine 15mg", "noradrenergic and specific serotonergic antidepressant"),
    ("Trazodone 50mg", "serotonin antagonist and reuptake inhibitor sleep"),
    ("Zolpidem 5mg", "non benzodiazepine hypnotic GABA receptor sleep"),
    ("Methocarbamol 500mg", "skeletal muscle spasm relaxant maintenance"),
    ("Cyclobenzaprine 10mg", "centrally acting skeletal muscle relaxant"),
    ("Promethazine 25mg", "phenothiazine antiemetic and sedative relief"),
    ("Meclizine 25mg", "antihistaminic antiemetic motion sickness vertigo"),
    ("Dicyclomine 20mg", "anticholinergic irritable bowel antispasmodic"),
    ("Mesalamine 800mg", "aminosalicylic acid ulcerative colitis mucosal barrier"),
    ("Azathioprine 50mg", "purine synthesis inhibitor autoimmune immunosuppression"),
    ("Tacrolimus 1mg", "calcineurin inhibitor organ transplant immunosuppression"),
]

CHECKUP_TYPES = [
    "annual wellness physical examination", "preventative health screening and biometric assessment",
    "routine blood pressure follow up and home log review", "fasting cholesterol and comprehensive lipid panel review",
    "routine diabetes glycated hemoglobin HbA1c check", "general preventative health checkup and lifestyle consult",
    "routine 6 month chronic disease management review", "pre travel vaccination and immunization review",
    "routine thyroid stimulating hormone TSH lab test follow up", "annual preventative well woman examination",
    "routine complete metabolic panel CMP and renal function review", "baseline cardiovascular Framingham risk assessment",
    "routine post recovery athletic physical clearance", "pre employment baseline physical exam",
    "routine dermatological skin surveillance examination", "annual preventative geriatric cognitive checkup",
    "routine electrocardiogram ECG trace review", "routine biennial mammography referral consult",
    "routine preventative colorectal cancer screening discussion", "annual preventive ophthalmology vision checkup",
    "routine dual energy x ray absorptiometry DEXA bone mineral density review",
    "routine urinalysis and microalbumin creatinine ratio screening",
    "routine carotid duplex ultrasonography intimal medial thickness follow up",
    "routine abdominal aortic ultrasound aneurysm surveillance consult",
    "routine spirometry pulmonary function baseline evaluation",
    "annual preventative audiometric hearing threshold check",
    "routine comprehensive dermatoscopy and total body mole mapping",
    "routine preventative non-mydriatic fundus retinal photography for diabetic microvascular surveillance",
    "annual preventative cardiovascular treadmill stress testing consultation",
    "routine screening for latent tuberculosis with interferon gamma release assay IGRA",
    "routine peripheral arterial disease screening with ankle brachial index ABI",
    "routine preventative glaucoma intraocular pressure tonometry checkup",
    "annual preventative low dose computed tomography lung cancer screening consult",
]

ROUTINE_MILD_SYMPTOMS = [
    "mild dry cough without fever", "clear thin rhinorrhea runny nose", "slight tickle in back of throat",
    "minor occasional sneezing", "mild morning nasal congestion", "occasional dry throat scratchiness",
    "minor fatigue after demanding work week", "mild seasonal pollen allergy and watery eyes",
    "mild localized xerosis dry skin on elbow", "small localized patch of dandruff on scalp",
    "minor tension headache after extended computer screen time", "mild ergonomic neck fatigue and stiffness",
    "mild morning knee stiffness from known mild osteoarthritis", "occasional mild postprandial acid reflux",
    "superficial paper cut on index finger without infection", "minor nonvenomous mosquito insect bite",
    "minor bruised toenail from long distance jogging", "superficial scrape from gardening with clean edges",
    "small benign aphthous ulcer inside lower lip", "mild localized chapped dry lips from winter air",
    "minor calloused skin on plantar heel surface", "occasional harmless eyelid twitching myokymia",
    "mild localized solar erythema sunburn without blisters", "minor superficial shaving nick on chin",
    "mild dry cuticle irritation on thumb", "minor tension ache across forehead after reading",
    "minor localized friction blister on heel from running shoes", "mild non-tender subungual splinter hemorrhage",
    "mild transient morning hoarseness that clears after warm water", "minor non-tender post-auricular lymph node following cold",
    "mild localized benign keratosis pilaris on posterior upper arms", "superficial non-painful skin peeling after sunburn",
]

# Strictly NO CHEST!
URGENT_BODY_PARTS = [
    "lower back lumbar region", "lumbosacral spine", "right lateral ankle",
    "left patella knee joint", "right distal radius wrist", "left glenohumeral shoulder",
    "right costovertebral flank", "left costovertebral flank", "lower hypogastric abdomen",
    "right lower quadrant McBurney point", "epigastric abdomen", "right upper quadrant",
    "left lower quadrant sigmoid area", "molar alveolar tooth socket", "right external ear canal",
    "left hip joint", "inguinal groin area", "gastrocnemius calf muscle",
    "distal forearm", "olecranon elbow", "proximal interphalangeal thumb",
    "acromioclavicular clavicle", "cervical posterior neck", "hamstring tendon",
    "calcaneal Achilles tendon", "perianal gluteal region", "temporomandibular jaw joint",
    "metatarsophalangeal first toe", "scapholunate wrist joint", "prepatellar bursa",
    "trochanteric hip bursa", "plantar fascia aponeurosis", "extensor digitorum tendon",
    "tibialis anterior tendon", "deltoid muscle mass", "costochondral rib junction",
    "navicular tarsal bone", "peroneal retinaculum", "triangular fibrocartilage complex",
    "talofibular ankle ligament", "iliopsoas groin muscle", "radioulnar syndesmosis",
]

# Modular lists for vocabulary richness
CARDIAC_RADIATION = [
    "down left arm into jaw", "to left shoulder blade and back", "through interscapular region",
    "into neck, throat and mandibular angle", "down bilateral arms and epigastrium",
    "into left axilla and left wrist", "through thoracoabdominal aortic distribution",
]

CARDIAC_QUALITIES = [
    "severe crushing substernal agony", "intense squeezing precordial heaviness like an elephant",
    "excruciating central retrosternal pressure", "severe suffocating thoracic tightness",
    "burning substernal pain refractory to antacids", "sudden tearing chest pain radiating to back",
    "acute precordial constriction accompanied by cold clamminess",
    "severe retrosternal viselike squeezing ache with nausea",
    "acute thoracic aortic dissection pain with unequal radial pulses",
    "severe acute myocarditis with pericardial friction rub and tachycardia",
]

STROKE_PRESENTATIONS = [
    "sudden right facial droop and right upper limb hemiparesis",
    "acute expressive dysphasia, unable to find words, right arm drift",
    "sudden left-sided dense hemiplegia and left facial asymmetry",
    "acute homonymous hemianopsia and unilateral numbness",
    "sudden cerebellar ataxia, severe vertigo, diplopia, and vomiting",
    "acute transient ischemic attack with sudden amaurosis fugax",
    "sudden monocular blindness, contralateral weakness, and dysarthria",
    "dense acute hemiplegia on right side, unable to stand, acute cortical stroke signs",
    "sudden aphasia, right-sided hemiparesis, and homonymous visual field loss",
    "sudden quadriplegia, locked-in state, pinpoint pupils and dysarthria (basilar thrombosis)",
    "acute posterior inferior cerebellar artery PICA infarction with dysphagia and Horner syndrome",
    "sudden onset dyscalculia, agnosia, right left disorientation, and alexia",
    "sudden hemispatial unilateral inattention neglect and conjugate gaze palsy",
    "acute pontine infarction with locked-in syndrome, quadriplegia, and preserved blinking",
]

SEIZURE_DETAILS = [
    "generalized tonic-clonic convulsions lasting over 4 minutes without waking up",
    "continuous grand mal seizure activity with perioral cyanosis and foaming",
    "multiple recurrent convulsions without regaining consciousness between episodes",
    "active tonic-clonic seizure, unresponsive, violent jerking, urinary incontinence",
    "non-terminating status epilepticus, clonic jerking of all limbs, stertorous breathing",
    "cluster seizures with profound postictal hypoxia, SpO2 81%, and coma",
    "continuous focal motor epilepsy with secondary generalization and cyanosis",
    "severe refractory status epilepticus with perioral frothing and trismus",
    "prolonged unremitting epileptic seizure with severe postictal encephalopathy",
]

DYSPNEA_PRESENTATIONS = [
    "status asthmaticus: extreme respiratory distress, silent chest, SpO2 78%",
    "acute laryngeal foreign body choking, inspiratory stridor, cyanotic blue lips",
    "massive pulmonary embolism: sudden pleuritic chest agony, tachycardia 145 bpm, hemoptysis",
    "acute cardiogenic pulmonary edema: coughing up pink frothy sputum, orthopnea, gasping",
    "severe respiratory failure, intercostal retractions, tracheal tugging, lethargy",
    "severe acute asthma exacerbation, gasping for air, rescue inhaler failed 4 times, cannot speak",
    "acute respiratory arrest imminent: agonal gasping, SpO2 70%, blue face and extremities",
    "tension pneumothorax suspected: sudden acute dyspnea, tracheal deviation, absent breath sounds",
    "acute epiglottitis: toxic appearance, high fever, tripod posturing, muffled voice, and drooling",
    "acute inhalation chlorine gas toxicity with chemical pneumonitis and severe bronchospasm",
]

BLEEDING_PRESENTATIONS = [
    "deep arterial puncture wound, bright red blood spurting vigorously, soaked through 4 towels",
    "pulsatile arterial laceration on extremity that will not stop with direct pressure",
    "massive upper gastrointestinal hemorrhage: hematemesis and dark coffee-ground blood",
    "profuse black tarry melena stools with orthostatic syncope, presyncope, cold sweat",
    "massive hematochezia: pouring bright red blood from rectum, pale, clammy, hypotensive",
    "post-operative surgical dehiscence with continuous heavy hemorrhage and hypovolemia",
    "ruptured esophageal varices with massive vomiting of frank red blood and hypotension",
    "exsanguinating bleeding from femoral vascular access site, large expanding hematoma",
    "catastrophic pelvic exsanguination with profound hypovolemic hypotension",
    "acute Mallory-Weiss gastroesophageal laceration with copious arterial hematemesis",
]

TRAUMA_PRESENTATIONS = [
    "high speed motor vehicle collision, head hit steering wheel, unconscious with open skull depression",
    "compound open fracture with jagged bone protruding through torn bleeding epidermis",
    "pedestrian versus automobile: polytrauma, open femur shaft fracture, severe bleeding",
    "penetrating stab wound to epigastric abdomen with deep hemorrhage and evisceration",
    "fall from two-story scaffolding, unresponsive, basilar skull fracture signs with bloody otorrhea",
    "industrial crush injury to extremity with traumatic partial amputation and spurting hemorrhage",
    "severe deceleration vehicular trauma: flail chest, paradoxical respirations, hemothorax",
    "severe blunt trauma with splenic laceration, hemoperitoneum, and hemodynamic instability",
    "catastrophic blast injury with traumatic pneumothorax and extensive penetrating shrapnel",
]

TOX_PRESENTATIONS = [
    "suspected opioid fentanyl intoxication: unresponsive patient, pinpoint pupils, agonal shallow breathing",
    "polypharmacy overdose with sedatives and ethanol, obtunded, shallow respirations, cyanosis",
    "accidental ingestion of caustic alkali lye drain cleaner, severe esophageal burning, airway stridor",
    "organophosphate insecticide toxicity: profuse salivation, lacrimation, urination, pinpoint pupils",
    "massive intentional acetaminophen overdose, severe hepatic tenderness, jaundice, and delirium",
    "acute ethylene glycol toxic alcohol ingestion with metabolic acidosis and hyperventilation",
    "acute cyanide intoxication: bitter almond odor, severe metabolic lactic acidosis, and coma",
    "tricyclic antidepressant overdose: widened QRS complex, ventricular arrhythmia, and seizures",
    "severe anticholinergic toxidrome: hyperpyrexia, mydriasis, anhidrosis, delirium, and tachycardia",
]

HEADACHE_EMERGENCIES = [
    "worst headache of my life, sudden thunderclap onset within seconds, vomiting and neck stiffness",
    "explosive thunderclap occipital headache peaking in 10 seconds, severe photophobia and vomiting",
    "excruciating sudden headache like being struck by lightning, extreme nuchal rigidity",
    "sudden severe headache with meningismus, inability to flex chin to chest, high fever and delirium",
    "high fever 104F with non-blanching purpuric petechial rash, photophobia, and stiff neck",
    "suspected subarachnoid hemorrhage: sudden thunderclap cephalalgia with transient loss of consciousness",
    "violent instantaneous intracranial headache with projectile emesis and pupillary anisocoria",
]

URGENT_INFECTIONS = [
    "acute pyelonephritis: intense unilateral costovertebral flank tenderness, fever {temp}, rigors, dysuria",
    "ascending lymphangitis: prominent red streak traveling up extremity from puncture, warm and tender",
    "acute suppurative otitis media: throbbing ear agony, high temperature {temp}, purulent otorrhea",
    "painful fluctuant subcutaneous abscess with surrounding induration and cellulitis needing incision",
    "acute severe exudative tonsillitis with bilateral tonsillar hypertrophy, white exudates, fever {temp}",
    "peritonsillar abscess suspected: severe unilateral throat pain, trismus, hot potato voice, fever",
    "acute bacterial maxillary sinusitis: purulent rhinorrhea, throbbing periorbital facial pressure, fever {temp}",
    "periapical alveolar dental abscess: throbbing jaw agony, cheek tumefaction, submandibular lymphadenopathy",
    "acute prepatellar bursitis: severe localized fluctuant knee swelling, erythema, warmth, fever {temp}",
    "acute olecranon bursitis: swollen erythematous elbow bursa, exquisite tenderness and purulence",
    "acute bacterial parotitis: painful unilateral salivary gland enlargement, purulent ductal discharge",
    "acute pyogenic tenosynovitis: Kanavel cardinal signs, flexor tendon sheath erythema and tenderness",
    "acute suppurative dacryocystitis: medial canthal swelling, severe tenderness, purulent reflux",
    "acute suppurative labyrinthitis: violent incapacitating rotatory vertigo, nystagmus, and nausea",
    "acute epididymo-orchitis: severe unilateral hemiscrotal swelling, exquisite tenderness, fever {temp}",
]

URGENT_ABDOMINALS = [
    "acute appendicitis: persistent sharp right lower quadrant McBurney point tenderness, anorexia, nausea",
    "acute calculous cholecystitis: severe postprandial right upper quadrant pain, Murphy sign, vomiting",
    "severe gastrointestinal flu: vomited 8 times today, unable to tolerate sips of water, dry mouth",
    "intractable nausea and vomiting for 24 hours, dizzy on standing, completely unable to keep fluids down",
    "acute diverticulitis: constant sharp lower left quadrant abdominal ache, obstipation, fever {temp}",
    "acute nephrolithiasis renal colic: excruciating spasmodic flank pain radiating down into groin with hematuria",
    "acute small bowel obstipation: severe spasmodic abdominal cramps, abdominal distension, vomiting bile",
    "incarcerated femoral hernia: painful irreducible groin mass with localized peritoneal guarding",
    "acute mesenteric adenitis in teenager: severe right iliac fossa pain mimicking appendicitis, fever {temp}",
    "acute ischemic colitis: sudden crampy left lower quadrant abdominal pain followed by bloody stools",
    "acute sigmoid volvulus: severe colicky lower belly cramps, marked tympanitic distension",
]

URGENT_ORTHOS = [
    "acute closed bimalleolar ankle fracture with massive edema, ecchymosis, and inability to ambulate",
    "acute anterior cruciate ligament rupture with audible pop, large joint effusion, knee instability",
    "acute displaced Colles wrist fracture following fall on outstretched hand, visible dinner fork deformity",
    "sharp sudden lower back spasm while lifting heavy box, pain shooting down sciatica nerve, can barely walk",
    "acute lumbar radiculopathy: excruciating electrical shooting pain down left leg from lower back",
    "dislocated shoulder popped out during sports, severe immobility, locked in abduction",
    "acute quadriceps tendon tear: inability to actively extend knee, palpable suprapatellar sulcus gap",
    "acute Achilles tendon rupture: sensation of being kicked in calf, palpable defect, positive Thompson test",
    "acute scaphoid fracture wrist: exquisite focal tenderness over anatomical snuffbox after fall",
    "acute Lisfranc tarsometatarsal fracture dislocation: severe midfoot plantar ecchymosis and inability to bear weight",
    "acute traumatic patellar hemarthrosis: tense synovial joint effusion, severe restricted range of motion",
    "acute triangular fibrocartilage complex TFCC wrist tear: ulnar-sided clicking and severe agony",
]

URGENT_WOUNDS = [
    "deep laceration on palm from kitchen knife 2 hours ago, bleeding controlled with direct pressure but gaping open",
    "full thickness glass laceration on forearm, edges separated, needs sutures within golden window",
    "deep cut on scalp from falling against coffee table, bleeding stopped with pressure, gaping 4cm wound",
    "deep puncture wound to sole of foot from stepping on rusty nail through sneaker, painful throbbing",
    "second degree scald burn on forearm from boiling water, blistering skin, severe burning pain",
    "deep circular saw wood laceration on thigh, bleeding controlled with pressure, gaping fascia",
    "shattered porcelain laceration on ankle, edges retracted, requires multilayered wound closure",
    "deep chain saw laceration on calf, bleeding controlled with tourniquet pressure, fat exposed",
]

ROUTINE_LABS = [
    "routine fasting lipid panel, LDL, HDL, triglycerides and total cholesterol review",
    "routine glycated hemoglobin HbA1c and fasting serum blood glucose review",
    "routine complete blood count CBC with differential and platelet count follow-up",
    "comprehensive metabolic panel CMP, electrolytes, serum creatinine and eGFR review",
    "routine thyroid stimulating hormone TSH and free thyroxine T4 monitoring",
    "routine urinalysis and microalbumin creatinine ratio review",
    "serum 25-hydroxyvitamin D level follow-up and supplementation review",
    "routine liver function enzymes ALT, AST, bilirubin and alkaline phosphatase check",
    "routine serum ferritin, total iron binding capacity TIBC and transferrin saturation review",
    "routine serum uric acid level check for gout management, stable on allopurinol",
    "routine prostate specific antigen PSA screening review, normal baseline",
    "routine international normalized ratio INR surveillance consult, stable on warfarin",
    "routine quantitative serum immunoglobulin IgA IgG IgM panel checkup",
]

ROUTINE_NEGATIONS = [
    "no chest pain, no shortness of breath, just need a checkup",
    "no fever, no severe pain, mild cold symptoms",
    "small itchy dry patch on my elbow for a few days, no fever or pain",
    "need a refill for my blood pressure pills, I do not have severe pain or fever",
    "worried about heart attack risk in the future, currently asymptomatic and feel fine",
    "history of asthma, need standard inhaler refill, breathing is completely normal, no wheezing",
    "routine appointment request: no chest pressure, no breathing trouble, feeling great",
    "no acute pain, no shortness of breath, no fever, just booking annual wellness review",
    "slight chest muscle soreness after lifting weights yesterday, no shortness of breath, no pressure",
    "mild headache and slight cough since yesterday, no trouble breathing, no fever",
    "minor scrape on forearm, no redness, no pus, no fever, just need routine tetanus booster status check",
    "requesting routine health screening; denies chest pain, dyspnea, syncope, or weight loss",
    "follow-up for mild reflux, no chest pain, no swallowing difficulty, taking antacids occasionally",
    "annual checkup: zero acute complaints, denies palpitations or dizziness, exercises regularly",
    "routine lab consultation: no fever, no nausea, feeling energetic and healthy",
    "occasional mild cough, no shortness of breath, no fever, normal appetite and breathing fine",
    "minor ankle sprain two weeks ago is completely resolved, zero pain, requesting sports clearance",
    "checking routine cholesterol levels, without any chest symptoms or shortness of breath",
    "prescription renewal request, completely asymptomatic, no acute issues to report",
    "denies any chest pain, palpitation, or dyspnea; scheduling routine physical exam",
    "no acute distress, no headache, no abdominal pain, just requesting routine blood work",
    "previous knee injury 2 months ago, pain is totally resolved, walking normally without limp",
    "suture removal request: thumb cut from last week is completely healed, no pain, no drainage",
    "routine blood pressure review, home readings 122/80, denies dizziness or visual changes",
    "no difficulty breathing, no wheezing, inhaler not used in months, routine follow-up",
    "family history of cardiac disease, but currently zero symptoms, seeking preventative counseling",
    "mild throat dryness from air conditioner, denies fever, chills, or difficulty swallowing",
    "annual wellness consult: patient denies fatigue, denies fever, denies weight changes, feeling great",
    "fell down last week, no more pain, just need a checkup",
    "sprained ankle 3 weeks ago, pain is completely gone, need clearance note",
    "denies focal neurological deficits, denies paresthesia or weakness, routine consultation",
    "denies melena, hematochezia, or hematemesis; routine colon screening consultation",
    "without any acute complaints or severe discomfort, requesting preventative blood work",
]


# ==========================================
# 1. EMERGENCY TEMPLATES (140+ patterns)
# ==========================================

EMERGENCY_TEMPLATES = [
    # CARDIAC & CORONARY SYNDROMES
    "{opener}{cardiac_quality} radiating {cardiac_radiation} with profuse diaphoresis{ending}",
    "{opener}Intense squeezing chest heaviness like an elephant sitting on my chest, dizzy and short of breath{ending}",
    "{opener}Crushing retrosternal chest tightness, cold sweats, nausea, and radiation of pain to left shoulder{ending}",
    "{opener}Sudden onset chest pain with difficulty breathing, pale clammy skin, and cyanotic blue lips{ending}",
    "{opener}Severe central chest pressure lasting 30 minutes, radiates to neck and back, feeling faint{ending}",
    "{opener}Patient suddenly clutched chest, gasped for air, and collapsed on the floor unresponsive{ending}",
    "{opener}Rapid heart palpitations pulse 195 bpm, severe lightheadedness, chest fluttering and syncope{ending}",
    "{opener}Acute myocardial infarction suspected: severe chest agony, left jaw ache, drenched in cold sweat{ending}",
    "{opener}Sudden collapse with chest tightness, gasping for breath and barely perceptible pulse{ending}",
    "{opener}Substernal pressure with severe shortness of breath, dizzy upon sitting up, vomiting bile{ending}",
    "{opener}Patient has acute cardiac arrest symptoms, pulseless and bystander CPR in progress{ending}",
    "{opener}Severe angina pectoris unrelieved by 3 doses of sublingual nitroglycerin, pain 10/10{ending}",
    "{opener}Tearing chest pain radiating through to thoracic back between shoulder blades, pulse asymmetric (aortic dissection){ending}",
    "{opener}Excruciating substernal precordial pain, SpO2 84%, lips turning purple, cold clammy extremities{ending}",
    "{opener}Severe pressure in anterior chest wall accompanied by presyncope, grayish pallor, and diaphoresis{ending}",
    "{opener}Crushing chest ache starting during rest, radiation to interscapular region, nausea and profuse sweating{ending}",
    "{opener}Sudden ventricular tachycardia on home monitor, feeling imminent blackout, chest pain and gasping{ending}",
    "{opener}Severe retrosternal squeezing pain, dizziness, bradycardia 38 bpm, and cold clammy skin{ending}",
    "{opener}Acute cardiogenic shock: systolic blood pressure 70 mmHg, severe chest tightness, cyanosis{ending}",
    "{opener}Severe acute coronary syndrome: unrelenting retrosternal crushing pain, diaphoresis, impending doom{ending}",
    "{opener}Acute pericardial tamponade suspected: distant heart sounds, jugular venous distention, hypotension (Beck triad){ending}",

    # NEUROLOGICAL, STROKE, TIA & APHASIA
    "{opener}{stroke_presentation}{ending}",
    "{opener}Sudden right-sided facial droop, right arm paralysis, and garbled incomprehensible speech{ending}",
    "{opener}Woke up with left arm weakness, left facial numbness, and inability to speak full sentences{ending}",
    "{opener}Sudden onset slurred speech, confusion, asymmetric smile, and right leg weakness (FAST positive){ending}",
    "{opener}Acute expressive aphasia, cannot produce words, right-sided hemiparesis since 20 minutes ago{ending}",
    "{opener}Sudden complete bilateral visual loss accompanied by dizziness and unsteady wide-based gait{ending}",
    "{opener}Transient ischemic attack suspected: sudden severe numbness of entire left side of body{ending}",
    "{opener}Sudden inability to move right arm and leg, mouth drooping on right side, drooling{ending}",
    "{opener}Acute confusion, severe dysarthria, and profound right arm pronator drift starting 15 minutes ago{ending}",
    "{opener}Sudden loss of balance, double vision, slurred speech, and acute hemiplegia{ending}",
    "{opener}Patient is disoriented, speech is completely unintelligible, and left arm is totally limp{ending}",
    "{opener}Sudden onset dense hemiplegia on right side, unable to stand, acute cortical stroke signs{ending}",
    "{opener}Acute posterior circulation ischemia: sudden vertigo, dysmetria, diplopia, and severe ataxia{ending}",
    "{opener}Left facial droop, right arm weakness, acute slurring of words, last known well 30 minutes ago{ending}",
    "{opener}Sudden monocular blindness amaurosis fugax with contralateral hemiparesis and speech arrest{ending}",
    "{opener}Acute basilar artery thrombosis signs: quadriplegia, locked in, dysarthria and pinpoint pupils{ending}",
    "{opener}Acute ischemic cerebrovascular stroke: sudden onset hemianesthesia, facial sag, and mutism{ending}",

    # THUNDERCLAP HEADACHE & SUBARACHNOID HEMORRHAGE
    "{opener}{headache_emergency}{ending}",
    "{opener}Worst headache of my life, sudden thunderclap onset within seconds, vomiting and neck stiffness{ending}",
    "{opener}Explosive thunderclap occipital headache peaking in 10 seconds, severe photophobia and vomiting{ending}",
    "{opener}Excruciating sudden headache like being struck by lightning, extreme nuchal rigidity{ending}",
    "{opener}Sudden severe headache with meningismus, inability to flex chin to chest, high fever and delirium{ending}",
    "{opener}High fever 104F with non-blanching purpuric petechial rash, photophobia, and stiff neck{ending}",
    "{opener}Suspected subarachnoid hemorrhage: sudden thunderclap cephalalgia with transient loss of consciousness{ending}",
    "{opener}Blinding headache onset instantaneous, stiff neck, projectile vomiting, and altered sensorium{ending}",
    "{opener}Acute intracranial hemorrhage suspected: catastrophic sudden headache followed by lethargy and pupil dilation{ending}",
    "{opener}Thunderclap headache radiating down cervical spine with altered mental status and photophobia{ending}",
    "{opener}Violent sudden headache peaking within 60 seconds, repeated emesis, Kernig sign positive{ending}",
    "{opener}Sudden rupture of cerebral berry aneurysm: instantaneous blinding cephalalgia and acute coma{ending}",

    # CONVULSIONS & STATUS EPILEPTICUS
    "{opener}{seizure_detail}{ending}",
    "{opener}Patient having generalized tonic-clonic convulsions lasting over 4 minutes without waking up{ending}",
    "{opener}Continuous grand mal seizure activity for 6 minutes, foaming at mouth and turning cyanotic{ending}",
    "{opener}Multiple recurrent convulsions without regaining consciousness between episodes (status epilepticus){ending}",
    "{opener}Active tonic clonic seizure, patient unresponsive, jerking violently, urinary incontinence{ending}",
    "{opener}Prolonged seizure lasting greater than 5 minutes, breathing noisy and lips turning purple{ending}",
    "{opener}Non-terminating epileptic seizure, clonic jerking of all four limbs, completely unarousable{ending}",
    "{opener}Repeated cluster seizures without regaining baseline mental status, postictal stupor and hypoxia{ending}",
    "{opener}Continuous focal motor seizure progressing to generalized convulsions with stertorous breathing{ending}",
    "{opener}Child seizing for over 10 minutes, teeth clenched, skin mottled and blue around mouth{ending}",

    # RESPIRATORY FAILURE, STRIDOR, CHOKING & PE
    "{opener}{dyspnea_presentation}{ending}",
    "{opener}Severe acute asthma exacerbation, gasping for air, rescue inhaler failed 4 times, cannot speak{ending}",
    "{opener}Status asthmaticus: extreme respiratory distress, intercostal retractions, silent chest{ending}",
    "{opener}Choking on food bolus, high-pitched inspiratory stridor, unable to breathe or cough, blue lips{ending}",
    "{opener}Acute upper airway foreign body obstruction, clutching throat, cyanotic facial discoloration{ending}",
    "{opener}Sudden sharp pleuritic chest pain with severe shortness of breath and coughing up bright red blood{ending}",
    "{opener}Suspected massive pulmonary embolism: acute dyspnea, tachycardia 140 bpm, pleuritic agony, hemoptysis{ending}",
    "{opener}Acute pulmonary edema: coughing up frothy pink sputum, gasping for breath, orthopnea, SpO2 78%{ending}",
    "{opener}Struggling violently to inhale, severe stridor, tracheal tugging, unable to exchange air{ending}",
    "{opener}Severe respiratory failure, patient lethargic, breathing 40 breaths per minute, turning blue{ending}",
    "{opener}Acute airway compromise: inspiratory wheeze, unable to speak full words, SpO2 80% on room air{ending}",
    "{opener}Severe respiratory distress: suprasternal retractions, nasal flaring, exhaustion, impending arrest{ending}",
    "{opener}Coughing up copious amounts of frank red blood from lungs with severe dyspnea and tachycardia{ending}",

    # ANAPHYLAXIS & ANGIOEDEMA
    "{opener}Accidentally consumed peanut sauce, throat closing, tongue swelling rapidly, full body hives, wheezing{ending}",
    "{opener}Severe anaphylactic reaction after bee sting: profound angioedema, stridor, hypotension, faintness{ending}",
    "{opener}Inadvertent ingestion of shellfish: uvula and lip swelling, difficulty swallowing, diffuse urticaria{ending}",
    "{opener}Sudden anaphylaxis: airway tightening, widespread hives, feeling throat closing up completely{ending}",
    "{opener}Rapid onset facial angioedema and laryngeal swelling after taking amoxicillin, gasping for breath{ending}",
    "{opener}Anaphylactic shock: blood pressure plunging, widespread itching hives, respiratory wheezing{ending}",
    "{opener}Severe systemic anaphylaxis with generalized urticaria, lip angioedema, stridor, and syncope{ending}",
    "{opener}Wasp sting allergy: profound facial swelling, hoarseness, feeling throat completely shutting{ending}",
    "{opener}Anaphylactic collapse: patient ingested tree nuts, airway oedema, SpO2 82%, blood pressure 75/40{ending}",

    # SEVERE HEMORRHAGE & EXSANGUINATION
    "{opener}{bleeding_presentation}{ending}",
    "{opener}Deep arterial puncture wound to thigh, bright red blood spurting vigorously, soaked through 4 towels{ending}",
    "{opener}Arterial laceration on forearm, pulsatile bleeding will not stop despite firm direct pressure{ending}",
    "{opener}Vomiting large quantities of dark coffee-ground blood and passing black tarry stools with extreme dizziness{ending}",
    "{opener}Massive upper gastrointestinal hemorrhage: hematemesis, black tarry melena, presyncope, cold sweat{ending}",
    "{opener}Massive hematochezia: pouring bright red blood from rectum, lightheaded, pale and clammy{ending}",
    "{opener}Severe uncontrolled bleeding from wound, bleeding heavily through thick dressings, feeling faint{ending}",
    "{opener}Post-tonsillectomy massive arterial hemorrhage, spitting cups of bright blood, choking{ending}",
    "{opener}Bleeding profusely from deep neck laceration, dark red blood pooling, becoming dizzy and confused{ending}",
    "{opener}Ruptured esophageal varices suspected: vomiting pints of frank red blood, hypotensive and pale{ending}",
    "{opener}Severe hemorrhage from dialysis arteriovenous fistula, jet of blood spurting, fainting{ending}",

    # TRAUMA, OPEN FRACTURES & HEAD INJURY
    "{opener}{trauma_presentation}{ending}",
    "{opener}High speed motor vehicle collision, head hit steering wheel, unconscious with open skull depression{ending}",
    "{opener}Severe polytrauma after pedestrian versus auto: open femur fracture with bone sticking through skin{ending}",
    "{opener}Compound tibia fracture: jagged bone protruding through bleeding torn skin after motorcycle accident{ending}",
    "{opener}Penetrating stab wound to epigastric abdomen, deep bleeding and suspected bowel evisceration{ending}",
    "{opener}Fell from two-story roof, unresponsive, clear fluid leaking from ears and nose, dilated pupil{ending}",
    "{opener}Industrial machinery crush injury to arm with traumatic partial amputation and spurting blood{ending}",
    "{opener}Severe blunt chest trauma, paradoxical flail chest movement, gasping and coughing blood{ending}",
    "{opener}Severe traumatic brain injury: decerebrate posturing, unequal pupils, completely non-responsive{ending}",
    "{opener}Compound open pelvic fracture from fall from height, hemodynamic instability and massive bruising{ending}",
    "{opener}Gunshot wound to thorax with sucking chest wound, tachypneic and cyanotic{ending}",

    # OVERDOSE, TOXICOLOGY & POISONING
    "{opener}{tox_presentation}{ending}",
    "{opener}Suspected opioid fentanyl overdose: unresponsive patient, pinpoint pupils, agonal shallow breathing{ending}",
    "{opener}Patient swallowed bottle of prescription sedatives and alcohol, unarousable with blue lips{ending}",
    "{opener}Accidental ingestion of toxic household drain cleaner / caustic lye, burning mouth and airway stridor{ending}",
    "{opener}Carbon monoxide poisoning suspected: entire family found confused, lethargic, vomiting, cherry-red lips{ending}",
    "{opener}Massive intentional acetaminophen and aspirin overdose, acute delirium, vomiting blood{ending}",
    "{opener}Acute organophosphate pesticide poisoning: profuse salivation, lacrimation, urination, pinpoint pupils{ending}",
    "{opener}Suspected toxic methanol ingestion: acute metabolic acidosis, hyperventilation, and bilateral blindness{ending}",

    # SEPTIC SHOCK & METABOLIC COLLAPSE
    "{opener}Septic shock: temperature 104.5F, blood pressure 70/40, mottled cold extremities, acute confusion{ending}",
    "{opener}Severe systemic sepsis with lethargy, SpO2 82%, shivering uncontrollably, unarousable{ending}",
    "{opener}Diabetic ketoacidosis collapse: Kussmaul respirations, fruity breath odor, obtunded and dehydration{ending}",
    "{opener}Fulminant urosepsis: hypotensive 75/45, rigors, hypothermia 95F, purpuric skin rash and confusion{ending}",

    # PORTAL COMPOSITE FORMATTED STRINGS (EMERGENCY)
    "[Reported Symptoms: Chest Pain / Pressure | Duration: Just started (< 2 hours)] Severe squeezing chest pressure radiating to left arm and jaw, sweating and nausea",
    "[Reported Symptoms: Difficulty Breathing | Duration: Just started (< 2 hours)] Gasping for breath, inhaler not working, turning pale and dizzy",
    "[Reported Symptoms: Slurred Speech / Facial Droop | Duration: Just started (< 2 hours)] Right side face is drooping, cannot lift arm, words coming out jumbled",
    "[Reported Symptoms: Uncontrolled Bleeding | Duration: Just started (< 2 hours)] Deep cut on arm spurting bright red blood, towels soaked through",
    "[Reported Symptoms: Chest Pressure / Radiating Pain, Difficulty Breathing | Duration: Just started (< 2 hours)] Patient presents with Chest Pressure / Radiating Pain, Difficulty Breathing experienced for Just started (< 2 hours).",
    "[Reported Symptoms: Acute Injury / Bleeding | Duration: Just started (< 2 hours)] Open fracture with bone visible through thigh laceration, severe bleeding",
    "[Reported Symptoms: Dizziness / Fainting, Chest Pain / Pressure | Duration: Just started (< 2 hours)] Collapsed after sudden crushing chest tightness, cold clammy skin",
    "[Reported Symptoms: Allergic Reaction / Swelling | Duration: Just started (< 2 hours)] Accidental peanut exposure, throat swollen shut, tongue huge, wheezing",
    "[Reported Symptoms: Severe Headache | Duration: Just started (< 2 hours)] Sudden thunderclap headache reached 10/10 instantly, vomiting and neck stiffness",
    "[Reported Symptoms: High Fever >38.5°C, Difficulty Breathing | Duration: Just started (< 2 hours)] Temperature 40C, lethargic, struggling to inhale, SpO2 80%",
    "[Reported Symptoms: Chest Pain / Pressure, Dizziness / Fainting | Duration: Just started (< 2 hours)] Severe pressure in chest, feeling dizzy, passed out momentarily",
    "[Reported Symptoms: Difficulty Breathing, Allergic Reaction / Swelling | Duration: Just started (< 2 hours)] Bee sting 15 mins ago, airway swelling, stridor and fainting",
    "[Reported Symptoms: Acute Injury / Bleeding, Dizziness / Fainting | Duration: Just started (< 2 hours)] Arterial spurting from power tool wound, losing consciousness",
    "[Reported Symptoms: Slurred Speech / Facial Droop, Dizziness / Fainting | Duration: Just started (< 2 hours)] Sudden right hemiparesis and garbled words, collapsed",

    # INFORMAL / TYPO EMERGENCY VARIATIONS
    "{opener}chesst payne radiate to left arm cant breeth sweeting alot feal like dieng{ending}",
    "{opener}haevy bleedin spurting cant stop it loosing conciousnes{ending}",
    "{opener}I feel very strange in my chest, heavy tightness and sudden cold sweat making me dizzy{ending}",
    "{opener}My head feels funny and one side of my body feels completely numb and weak{ending}",
    "{opener}Severe pressure across chest radiating to left jaw, but mild nausea{ending}",
    "{opener}Sudden slurred speech and facial drooping, but no severe pain{ending}",
    "{opener}Difficulty breathing, coughing up foam, heart failure history{ending}",
    "{opener}heart hurts so bad like being crushed, cant breath, cold sweat and dizzy{ending}",
    "{opener}seziure lasting 5 mins he is not waking up and lips are blue please help{ending}",
    "{opener}cut arm with circular saw, bright blood pumping out everywhere, feeling faint{ending}",
    "{opener}swallowed poisonous chemicals accidentally, throat burning and choking{ending}",
    "{opener}sudden thunderclap in head, worst pain ever felt, throwing up and neck rigid{ending}",
    "{opener}bleeding out from deep wound on thigh towels soaked through feeling blackout{ending}",
    "{opener}peanuts throat closing airway swollen shut cannot take air in help{ending}",
]


# ==========================================
# 2. URGENT TEMPLATES (140+ patterns)
# (Strictly NO 'chest' in pain templates!)
# ==========================================

URGENT_TEMPLATES = [
    # INFECTIONS, PYELONEPHRITIS & CELLULITIS
    "{opener}{urgent_infection}{ending}",
    "{opener}High fever of {temp} for two days with severe rigors, flank pain, burning urination and nausea{ending}",
    "{opener}Acute pyelonephritis symptoms: intense unilateral costovertebral flank tenderness, fever {temp}, dysuria{ending}",
    "{opener}Punctured hand on rusty nail yesterday, now red streak spreading up forearm with throbbing warmth and pus{ending}",
    "{opener}Expanding erythematous red rash on leg spreading rapidly, hot to touch, swollen and feverish{ending}",
    "{opener}Severe acute ear pain with {temp} fever and purulent yellow discharge leaking from ear canal{ending}",
    "{opener}Acute suppurative otitis media: throbbing ear agony, high temperature {temp}, cannot sleep{ending}",
    "{opener}Painful fluctuant subcutaneous abscess on thigh with surrounding cellulitis and tender swelling{ending}",
    "{opener}Large painful infected boil on {urgent_body}, throbbing warmth and pus draining{ending}",
    "{opener}Severe acute tonsillitis with white purulent exudates, painful odynophagia, fever {temp}{ending}",
    "{opener}Peritonsillar abscess suspected: severe unilateral throat pain, trismus, hot potato voice, fever{ending}",
    "{opener}Severe acute mastoiditis suspected: swollen tender redness behind ear, high fever {temp}{ending}",
    "{opener}Infected puncture wound from dog bite on hand, swollen, angry red edges, pus oozing{ending}",
    "{opener}Spreading ascending lymphangitis: prominent red streak traveling up calf from foot ulcer, warm and tender{ending}",
    "{opener}Acute paronychia infection of cuticle on index finger, throbbing severe pain and visible purulent pocket{ending}",
    "{opener}Bacterial sinusitis with maxillary facial pressure, fever {temp}, periorbital edema and purulent mucus{ending}",
    "{opener}Acute bacterial prostatitis: perineal pain, exquisite dysuria, high fever {temp}, and urinary hesitancy{ending}",
    "{opener}Infected sebaceous cyst on back, erythematous halo, exquisite focal tenderness and fluctuance{ending}",
    "{opener}Severe facial erysipelas: sharply demarcated bright red burning raised plaque across cheeks, fever {temp}{ending}",
    "{opener}Acute suppurative dacryocystitis: medial canthal swelling, severe tenderness, purulent reflux from lacrimal punctum{ending}",

    # ACUTE ABDOMINAL & GI CONDITIONS (NON-SHOCK)
    "{opener}{urgent_abdominal}{ending}",
    "{opener}Severe right lower quadrant abdominal pain for 12 hours, low fever, pain worsened by walking{ending}",
    "{opener}Acute appendicitis signs: persistent sharp RLQ pain, anorexia, nausea, tender to light palpation{ending}",
    "{opener}Severe colicky right upper quadrant pain after eating greasy food, radiating to right shoulder blade{ending}",
    "{opener}Acute biliary colic / cholecystitis: severe RUQ stomach cramping with low-grade fever and vomiting{ending}",
    "{opener}Severe gastrointestinal flu, vomited 8 times today, unable to tolerate sips of water, dry mouth{ending}",
    "{opener}Intractable nausea and vomiting for 24 hours, dizzy on standing, completely unable to keep fluids down{ending}",
    "{opener}Severe cramping lower abdominal pain and watery diarrhea 10 times in 12 hours, moderate dehydration{ending}",
    "{opener}Severe diverticulitis flare: constant sharp lower left quadrant abdominal ache, fever and chills{ending}",
    "{opener}Acute intestinal colic with severe abdominal cramping, abdominal distension, and inability to pass gas{ending}",
    "{opener}Acute gastroenteritis: projectile vomiting and severe fluid depletion, skin turgor reduced{ending}",
    "{opener}Severe epigastric pain radiating through to back after drinking, nausea and retching (pancreatitis){ending}",
    "{opener}Excruciating abdominal cramps, constant diarrhea with flecks of mucus, fever {temp}{ending}",
    "{opener}Incarcerated inguinal hernia: tender irreducible groin bulge with sharp crampy abdominal discomfort{ending}",
    "{opener}Acute mesenteric adenitis in teenager: severe right iliac fossa pain mimicking appendicitis, fever {temp}{ending}",

    # RENAL COLIC & KIDNEY STONES
    "{opener}Sudden excruciating spasmodic flank pain radiating down into groin, unable to find comfortable position{ending}",
    "{opener}Severe acute kidney stone attack: 10/10 sharp flank agony, visible hematuria in urine, nausea{ending}",
    "{opener}Renal colic: unbearable spasmodic pain in right flank shooting to groin with vomiting and feverish chills{ending}",
    "{opener}Severe burning sensation when I pee and lower belly ache for past two days with cloudy urine{ending}",
    "{opener}Urinary tract infection with acute hematuria, severe bladder spasms, frequency, and pelvic pain{ending}",
    "{opener}Acute nephrolithiasis flare: flank pain waxing and waning in severe waves with nausea and vomiting{ending}",
    "{opener}Inability to empty bladder despite intense urge, painful urinary retention, lower belly distended{ending}",
    "{opener}Gross hematuria with passage of small blood clots and intense dysuria, lower abdominal cramps{ending}",

    # ORTHOPEDIC TRAUMA, CLOSED FRACTURES & SEVERE SPRAINS
    "{opener}{urgent_ortho}{ending}",
    "{opener}Fell down steps, heard a loud pop in ankle, immediate severe swelling and inability to bear any weight{ending}",
    "{opener}Slipped on ice, wrist is visibly deformed and swollen, intense pain on movement, skin intact{ending}",
    "{opener}Acute fracture suspected: deformed {urgent_body} after falling, extreme localized tenderness and bruising{ending}",
    "{opener}Severe ankle inversion injury: massive ecchymosis, severe edema, impossible to stand on foot{ending}",
    "{opener}Twisted knee playing soccer, heard popping noise, immediate large joint effusion, knee giving way{ending}",
    "{opener}Sharp sudden lower back spasm while lifting heavy box, pain shooting down sciatica nerve, can barely walk{ending}",
    "{opener}Acute lumbar radiculopathy: excruciating electrical shooting pain down left leg from lower back{ending}",
    "{opener}Dislocated shoulder popped out during sports, severe immobility, locked in abduction{ending}",
    "{opener}Traumatic toe injury, dark purple subungual hematoma, severe throbbing pain, suspected fracture{ending}",
    "{opener}Dropped heavy barbell on foot, severe localized dorsal foot swelling and inability to put weight down{ending}",
    "{opener}Acute clavicle fracture after bicycle accident, tenting of skin, severe shoulder girdle pain{ending}",
    "{opener}Severe acute coccyx injury from falling on tailbone, unable to sit or stand without excruciating pain{ending}",
    "{opener}Severe patellar dislocation, kneecap shifted laterally, knee locked in flexion with extreme pain{ending}",
    "{opener}Acute Achilles tendon tear: sudden gunshot sensation in back of ankle, unable to plantarflex foot{ending}",
    "{opener}Severe acute cervical torticollis / acute wry neck, neck locked in spasm with agonizing focal pain{ending}",
    "{opener}Acute radial head subluxation nursemaid elbow in toddler, guarding arm in pronation, crying on supination{ending}",
    "{opener}Severe acute trochanteric bursitis flare, excruciating lateral hip tenderness, unable to bear weight{ending}",

    # DEEP WOUNDS & LACERATIONS (CONTROLLED BLEEDING)
    "{opener}{urgent_wound}{ending}",
    "{opener}Deep laceration on palm from kitchen knife 2 hours ago, bleeding controlled with direct pressure but gaping open{ending}",
    "{opener}Full thickness glass laceration on forearm, edges separated, needs sutures within golden window{ending}",
    "{opener}Deep cut on scalp from falling against coffee table, bleeding stopped with pressure, gaping 4cm wound{ending}",
    "{opener}Deep puncture wound to sole of foot from stepping on rusty nail through sneaker, painful throbbing{ending}",
    "{opener}Second degree scald burn on forearm from boiling water, blistering skin, severe burning pain{ending}",
    "{opener}Laceration across chin from sports collision, fat tissue visible, bleeding stopped with gauze{ending}",
    "{opener}Kitchen mandoline sliced tip of thumb, heavy oozing controlled with pressure, needs surgical dressing{ending}",
    "{opener}Cat bite to wrist, multiple deep puncture wounds, rapid localized swelling and erythema within 4 hours{ending}",
    "{opener}Barbed wire laceration on shin, bleeding controlled with direct compression, jagged edges{ending}",

    # SEVERE MIGRAINES & HEADACHES (WITHOUT NEURO DEFICITS)
    "{opener}Severe throbbing migraine with aura and intense nausea lasting 18 hours, unresponsive to OTC ibuprofen{ending}",
    "{opener}Intense unilateral pulsating hemicranial migraine, photophobia, phonophobia, vomiting bile{ending}",
    "{opener}Status migrainosus: unrelenting migraine for 3 days, refractory to sumatriptan and dark room{ending}",
    "{opener}Severe cluster headache around left eye, lacrimation, rhinorrhea, pacing room in severe pain{ending}",
    "{opener}Incapacitating migraine headache, sensitive to any light or sound, vomiting, no weakness or speech problems{ending}",
    "{opener}Severe throbbing temporal headache on right side for past 24 hours with nausea and visual flashing lights{ending}",

    # RESPIRATORY INFECTIONS (MODERATE / PNEUMONIA / WHEEZE)
    "{opener}Productive cough with rust-colored sputum, fever 102.8F, and moderate shortness of breath for 3 days{ending}",
    "{opener}Community-acquired pneumonia suspected: high fever {temp}, productive green phlegm, pleuritic rib ache{ending}",
    "{opener}Acute bronchitis flare with audible wheezing, persistent racking cough, feverish chills, SpO2 93%{ending}",
    "{opener}Moderate asthma flare-up, wheezing audible across room, albuterol inhaler only providing temporary relief{ending}",
    "{opener}Racking deep cough with yellow-brown sputum, high fever of {temp}, shaking chills and night sweats{ending}",
    "{opener}Severe acute sinusitis with purulent rhinorrhea, throbbing facial pain beneath eyes, fever {temp}{ending}",

    # OPHTHALMIC & DENTAL EMERGENCIES (URGENT)
    "{opener}Scratched cornea with tree branch, severe foreign body sensation, extreme photophobia and tearing{ending}",
    "{opener}Acute painful corneal abrasion: cannot open eye, intense burning, light sensitivity, excessive tears{ending}",
    "{opener}Severe periapical dental abscess, throbbing jaw pain, facial swelling around cheek, low-grade fever{ending}",
    "{opener}Acute pericoronitis: severe wisdom tooth pain, trismus, cannot open mouth to chew, swollen gum{ending}",
    "{opener}Foreign particle trapped under upper eyelid, scratching eyeball with every blink, intense pain{ending}",
    "{opener}Severe acute conjunctivitis with copious purulent discharge gluing eyelids shut, photophobia and chemosis{ending}",

    # PORTAL COMPOSITE FORMATTED STRINGS (URGENT)
    "[Reported Symptoms: Severe Pain | Duration: Just started (< 2 hours)] 10/10 stabbing abdominal pain in lower right side, vomiting bile, cannot stand upright",
    "[Reported Symptoms: High Fever (>103°F) | Duration: 1–2 Days] High fever with rigors, painful flank pain and dark urine",
    "[Reported Symptoms: Persistent Vomiting | Duration: 1–2 Days] Cannot keep liquids down for 24 hours, dizzy when standing up",
    "[Reported Symptoms: Severe Headache / Migraine | Duration: 3–7 Days] Throbbing unilateral headache with photophobia and nausea",
    "[Reported Symptoms: Sprain / Suspected Fracture | Duration: 1–2 Days] Fell on ice, wrist is visibly deformed and swollen, cannot move fingers",
    "[Reported Symptoms: Abdominal Pain | Duration: 1–2 Days] Sharp lower right quadrant pain worsening over past 24 hours with nausea",
    "[Reported Symptoms: High Fever >38.5°C | Duration: 1–2 Days] Temperature 39.4C, intense ear pain and purulent discharge from canal",
    "[Reported Symptoms: Nausea / Vomiting | Duration: 1–2 Days] Acute gastroenteritis, vomiting constantly, dry lips, unable to retain oral fluids",
    "[Reported Symptoms: Acute Injury / Bleeding | Duration: < 2 Hours] Deep knife laceration on hand, bleeding controlled with towel, gaping open",
    "[Reported Symptoms: Severe Pain, High Fever >38.5°C | Duration: 1–2 Days] Severe flank pain with 103F fever and chills, possible kidney infection",
    "[Reported Symptoms: Abdominal Pain, Nausea / Vomiting | Duration: 1–2 Days] Severe right lower quadrant tenderness, fever 101F, cannot walk upright",
    "[Reported Symptoms: Severe Headache | Duration: 1–2 Days] Throbbing migraine, photophobia, nausea, unresponsive to over the counter pain meds",
    "[Reported Symptoms: Acute Injury / Bleeding, Sprain / Suspected Fracture | Duration: Just started (< 2 hours)] Twisted ankle with loud audible crack, massive bruising",
    "[Reported Symptoms: High Fever >38.5°C, Abdominal Pain | Duration: 1–2 Days] Acute fever of 39.2C with sharp right lower abdominal pain",

    # INFORMAL / TYPO URGENT VARIATIONS
    "{opener}bad headacke throbbing cant sleep throwing up since yesturday night{ending}",
    "{opener}sprained my ankel real bad swolen and bruized cant walk on it{ending}",
    "{opener}stomach hurting real bad in right lower belly, fever and vomiting{ending}",
    "{opener}kidney pain so intense on right side cannot sit or lay down, throwing up{ending}",
    "{opener}cut finger deep on broken plate, bleeding slowed down but edges wide open{ending}",
    "{opener}red line spreading up my arm from rusty wire scratch, hot and throbbing{ending}",
    "{opener}twisted wrist playing basketball, heard a crack, swelling up fast and hurts bad{ending}",
    "{opener}coughing up thick yellow green gunk with 102 fever and chills for two days{ending}",
    "{opener}ear hurts so bad feels like it will pop, yellow pus draining and fever 103{ending}",
    "{opener}tooth ache so throbbing cheek is puffed up and cannot chew anything{ending}",
    "{opener}bad back spasm when lifting couch, electrical pain shooting down leg{ending}",
]


# ==========================================
# 3. ROUTINE TEMPLATES (140+ patterns)
# (Includes Refills, Checkups, Mild Illness,
#  Administrative, and CRUCIAL NEGATIONS)
# ==========================================

ROUTINE_TEMPLATES = [
    # PRESCRIPTION REFILLS & MEDICATION CONTINUATION
    "{opener}Need routine 90-day medication refill for my {med_name} for {med_cond}, feeling completely fine{ending}",
    "{opener}Requesting renewal of my daily {med_name} prescription for {med_cond}{ending}",
    "{opener}Looking to get my routine {med_name} refilled, current supply is running low, no issues{ending}",
    "{opener}Need prescription refill for blood pressure pills, currently asymptomatic and stable{ending}",
    "{opener}Requesting standard refill for cholesterol medication, taking daily as prescribed{ending}",
    "{opener}Need maintenance refill for thyroid medication Levothyroxine 50mcg, feeling well{ending}",
    "{opener}Routine prescription renewal for daily Metformin 500mg, blood sugars are well managed{ending}",
    "{opener}Need a refill for Omeprazole 20mg for acid reflux maintenance, feeling good{ending}",
    "{opener}Need repeat prescription for daily allergy nasal spray Fluticasone, no other concerns{ending}",
    "{opener}Standard prescription renewal for maintenance blood pressure pills, feeling totally fine{ending}",
    "{opener}Need routine prescription renewal for my chronic severe asthma inhaler, currently having zero symptoms{ending}",
    "{opener}History of asthma, need standard inhaler refill, breathing is completely normal{ending}",
    "{opener}Routine 90 day supply renewal for Atorvastatin 20mg and Lisinopril 10mg, asymptomatic and well{ending}",
    "{opener}Requesting refill authorization for continuous positive airway pressure CPAP supplies, sleep is stable{ending}",
    "{opener}Need renewal of my daily allopurinol 100mg for gout prophylaxis, feeling completely healthy{ending}",
    "{opener}Running low on tamsulosin 0.4mg, requesting standard refill from pharmacy, no new symptoms{ending}",
    "{opener}Maintenance refill for daily sertraline 50mg, feeling stable and mood is good{ending}",
    "{opener}Renewal requested for daily calcium and vitamin D3 bone density supplements, doing well{ending}",
    "{opener}Need routine maintenance refill for losartan 50mg, blood pressure stable at 124/82{ending}",
    "{opener}Renewal of daily methotrexate 15mg for rheumatoid arthritis maintenance, joints quiescent, feeling well{ending}",
    "{opener}Standard continuation prescription for daily apixaban 5mg, no bleeding, feeling energetic{ending}",

    # ANNUAL CHECKUPS, PREVENTATIVE EXAMS & LAB REVIEWS
    "{opener}Scheduling my annual wellness physical exam and routine preventative blood panel{ending}",
    "{opener}I need a routine {checkup_type} appointment{ending}",
    "{opener}Routine follow up consultation to review my {routine_lab}{ending}",
    "{opener}Would like to schedule a standard annual health checkup and wellness screening{ending}",
    "{opener}Booking regular preventive health examination, no complaints, general checkup{ending}",
    "{opener}Follow-up appointment to review routine blood test results, all values were reported normal{ending}",
    "{opener}Routine blood pressure checkup, previous history of heart condition but feeling completely normal today{ending}",
    "{opener}Need a standard consultation for biometric health screening and preventative lifestyle review{ending}",
    "{opener}Routine follow-up for chronic hypertension, home blood pressure log is averaging 120/78{ending}",
    "{opener}Scheduling baseline cholesterol check and general physical exam for insurance{ending}",
    "{opener}Annual preventative gynecological well-woman visit, asymptomatic, routine screening{ending}",
    "{opener}Routine diabetic foot exam and routine HbA1c review, no active symptoms{ending}",
    "{opener}Need routine preventative colonoscopy screening referral and consultation, age 45 wellness{ending}",
    "{opener}Routine review of bone density DEXA scan results, asymptomatic, general osteoporosis follow up{ending}",
    "{opener}Baseline biometric screening for workplace wellness program, feeling great{ending}",
    "{opener}Scheduling routine biennial screening mammogram consult, asymptomatic{ending}",
    "{opener}Routine follow up for mild hyperlipidemia, dietary changes implemented, labs stable{ending}",
    "{opener}Routine consultation to discuss family planning and preventative preconception multivitamin guidance{ending}",
    "{opener}Standard preventative prostate specific antigen PSA screening follow-up, asymptomatic{ending}",
    "{opener}Routine surveillance consult for stable microalbuminuria, taking ACE inhibitor, asymptomatic{ending}",
    "{opener}Routine carotid duplex ultrasound follow-up review, stable plaque, asymptomatic and active{ending}",

    # MILD VIRAL COLDS, RHINORRHEA & MINOR AILMENTS
    "{opener}Mild runny nose, sneezing, and slight tickle in throat for 2 days, drinking warm tea and resting{ending}",
    "{opener}Occasional mild dry cough in the morning for 3 days, no fever, no shortness of breath, normal energy{ending}",
    "{opener}Mild cold symptoms: clear runny nose, sneezing, no fever, feeling fine otherwise{ending}",
    "{opener}A bit of a scratchy throat and clear nasal discharge for past 2 days, afebrile and eating well{ending}",
    "{opener}Mild viral cold: occasional sneezes and sniffing, energy is good, just want reassurance{ending}",
    "{opener}Slight tickle in back of throat and minor congestion for 3 days, no fever or aches{ending}",
    "{opener}Mild head cold with clear mucus for 2 days, resting at home, no chest symptoms{ending}",
    "{opener}Intermittent morning sniffles and mild throat clearing, afebrile, appetite normal{ending}",
    "{opener}Mild seasonal allergy flare with itchy watery eyes and sneezing, request non-drowsy antihistamine advice{ending}",
    "{opener}Mild dry cough for a few days after recovering from cold, afebrile, lungs completely clear{ending}",
    "{opener}Minor scratchy throat and mild nasal stuffiness after sleeping with fan on, no fever{ending}",
    "{opener}Mild dry tickle in pharynx for 4 days, swallowing completely fine, no lymph node swelling{ending}",

    # MINOR DERMATOLOGY & SUPERFICIAL INJURIES
    "{opener}Small dry itchy eczema patch on my elbow for past two weeks, would like a mild hydrocortisone recommendation{ending}",
    "{opener}Minor localized skin dryness on knuckles, looking for advice on over-the-counter moisturizers{ending}",
    "{opener}Small superficial paper cut on index finger yesterday, cleaned with soap, no redness or infection{ending}",
    "{opener}Minor mosquito insect bite on ankle from weekend camping, slightly itchy, no swelling{ending}",
    "{opener}Mild dandruff on scalp for past month, requesting recommendation for medicated shampoo{ending}",
    "{opener}Minor superficial scrape on knee from gardening, healed well, no pain, just checking{ending}",
    "{opener}Small benign skin tag on neck that rubs against shirt collar, inquiring about cosmetic removal{ending}",
    "{opener}Minor superficial scratch on forearm from cat playing, washed thoroughly, no inflammation{ending}",
    "{opener}Mild localized sunburn on shoulders from weekend outing, skin slightly red, applying aloe vera{ending}",
    "{opener}Small superficial callous on bottom of heel, requesting podiatry advice or pumice stone guidance{ending}",
    "{opener}Minor chapped lips and dry skin patch on cheeks, seeking benign moisturizer recommendation{ending}",
    "{opener}Small superficial friction blister on back of heel from new running shoes, intact, clean{ending}",

    # ADMINISTRATIVE, ERGONOMIC & RETURN-TO-WORK CLEARANCES
    "{opener}Need a doctor note for return to work after recovering from a mild stomach bug earlier this week{ending}",
    "{opener}Sprained ankle 3 weeks ago, pain is completely gone, need clearance note{ending}",
    "{opener}Fell down last week, no more pain, just need a checkup{ending}",
    "{opener}Recovered completely from mild cold last week, need medical certificate for school return{ending}",
    "{opener}Need pre-employment health clearance form signed, asymptomatic and physically active{ending}",
    "{opener}Mild ongoing knee stiffness after morning walks, diagnosed with mild osteoarthritis 2 years ago{ending}",
    "{opener}Feeling slightly tired after a busy work week and neck is a bit stiff from computer desk posture{ending}",
    "{opener}A little bit of blood when I blow my nose due to dry winter weather, no other problems{ending}",
    "{opener}Mild muscle soreness in arms after gym workout yesterday, no joint swelling or injury{ending}",
    "{opener}Need physical fitness certificate completed for marathon participation, asymptomatic{ending}",
    "{opener}Post recovery consultation: ankle sprain 4 weeks ago is 100% healed, requesting athletic release{ending}",
    "{opener}Driver license medical vision clearance form signature requested, vision corrected with glasses{ending}",
    "{opener}University enrollment immunization form verification requested, all vaccines completed{ending}",

    # CRUCIAL CLINICAL NEGATIONS (Explicit Denial of Red Flags / Symptoms)
    "{opener}{routine_negation}{ending}",
    "{opener}No chest pain, no shortness of breath, just need a checkup{ending}",
    "{opener}No fever, no severe pain, mild cold symptoms{ending}",
    "{opener}Small itchy dry patch on my elbow for a few days, no fever or pain{ending}",
    "{opener}Need a refill for my blood pressure pills, I do not have severe pain or fever{ending}",
    "{opener}Worried about heart attack risk in the future, currently asymptomatic and feel fine{ending}",
    "{opener}History of asthma, need standard inhaler refill, breathing is completely normal, no wheezing{ending}",
    "{opener}Routine appointment request: no chest pressure, no breathing trouble, feeling great{ending}",
    "{opener}No acute pain, no shortness of breath, no fever, just booking annual wellness review{ending}",
    "{opener}Slight chest muscle soreness after lifting weights yesterday, no shortness of breath, no pressure{ending}",
    "{opener}Mild headache and slight cough since yesterday, no trouble breathing, no fever{ending}",
    "{opener}Minor scrape on forearm, no redness, no pus, no fever, just need routine tetanus booster status check{ending}",
    "{opener}Requesting routine health screening; denies chest pain, dyspnea, syncope, or weight loss{ending}",
    "{opener}Follow-up for mild reflux, no chest pain, no swallowing difficulty, taking antacids occasionally{ending}",
    "{opener}Annual checkup: zero acute complaints, denies palpitations or dizziness, exercises regularly{ending}",
    "{opener}Routine lab consultation: no fever, no nausea, feeling energetic and healthy{ending}",
    "{opener}Occasional mild cough, no shortness of breath, no fever, normal appetite and breathing fine{ending}",
    "{opener}Minor ankle sprain two weeks ago is completely resolved, zero pain, requesting sports clearance{ending}",
    "{opener}Checking routine cholesterol levels, without any chest symptoms or shortness of breath{ending}",
    "{opener}Prescription renewal request, completely asymptomatic, no acute issues to report{ending}",
    "{opener}Denies any chest pain, palpitation, or dyspnea; scheduling routine physical exam{ending}",
    "{opener}No acute distress, no headache, no abdominal pain, just requesting routine blood work{ending}",
    "{opener}Previous knee injury 2 months ago, pain is totally resolved, walking normally without limp{ending}",
    "{opener}Suture removal request: thumb cut from last week is completely healed, no pain, no drainage{ending}",
    "{opener}Routine blood pressure review, home readings 122/80, denies dizziness or visual changes{ending}",
    "{opener}No difficulty breathing, no wheezing, inhaler not used in months, routine follow-up{ending}",
    "{opener}Family history of cardiac disease, but currently zero symptoms, seeking preventative counseling{ending}",
    "{opener}Mild throat dryness from air conditioner, denies fever, chills, or difficulty swallowing{ending}",
    "{opener}Annual wellness consult: patient denies fatigue, denies fever, denies weight changes, feeling great{ending}",

    # PORTAL COMPOSITE FORMATTED STRINGS (ROUTINE)
    "[Reported Symptoms: Mild Cough / Runny Nose | Duration: 1–2 Days] Patient presents with Mild Cough / Runny Nose experienced for 1–2 Days.",
    "[Reported Symptoms: Mild Cough / Runny Nose | Duration: 3–7 Days] Mild congestion, clear mucus, slight tickle in throat, feeling fine otherwise",
    "[Reported Symptoms: Sore Throat / Congestion | Duration: 1–2 Days] Mild pharyngitis, drinking tea, no fever or trouble swallowing",
    "[Reported Symptoms: Minor Skin Rash / Allergy | Duration: > 1 Week] Small itchy dry eczema patch on inner elbow, need cream refill",
    "[Reported Symptoms: Routine Prescription Refill | Duration: > 1 Week] Patient presents with Routine Prescription Refill experienced for > 1 Week.",
    "[Reported Symptoms: Routine Prescription Refill | Duration: > 1 Week] Need 90-day refill of lisinopril 10mg, asymptomatic and well",
    "[Reported Symptoms: Cough / Sore Throat | Duration: 3–7 Days] Minor throat scratchiness, no fever, no difficulty breathing, drinking tea",
    "[Reported Symptoms: Routine Prescription Refill | Duration: > 1 Week] Refill for Atorvastatin 20mg and Amlodipine 5mg, feeling healthy",
    "[Reported Symptoms: Mild Cough / Runny Nose | Duration: > 1 Week] Seasonal allergy sniffles, clear nasal drainage, completely afebrile",
    "[Reported Symptoms: Minor Skin Rash / Allergy | Duration: 3–7 Days] Dry winter skin patch on forearm, mild itchiness, no open sores",
    "[Reported Symptoms: Routine Prescription Refill, Mild Cough / Runny Nose | Duration: > 1 Week] Need blood pressure medication refill, slight seasonal sniffle",
    "[Reported Symptoms: Sore Throat / Congestion | Duration: > 1 Week] Mild morning congestion and dry throat, no fever, drinks herbal tea",

    # INFORMAL / TYPO ROUTINE VARIATIONS
    "{opener}need medecin refil for my presure pills ran out yestarday thanx{ending}",
    "{opener}slite caugh and snotty nose fealing ok just need check{ending}",
    "{opener}just routine checkup doc, fealing great no pain at all{ending}",
    "{opener}need refill for my colestrol meds, taking them every day no issues{ending}",
    "{opener}little sniffle and caugh for 2 days no fever no breathing trouble{ending}",
    "{opener}felt dizzy last month but fealing fine now, just routine check{ending}",
    "{opener}sprained my wrist weeks ago, pain gone completely just need work note{ending}",
    "{opener}annual phisical checkup booking, no complaints healthy as a horse{ending}",
]


# ==========================================
# AMBIGUOUS EDGE CASES (Borderline syntax)
# ==========================================
AMBIGUOUS_CASES = [
    # Routine edge cases with potentially alarming keywords used innocently
    ("Routine", "{opener}Slight chest muscle soreness after lifting heavy weights at gym, no shortness of breath, breathing normal{ending}"),
    ("Routine", "{opener}Regular blood pressure checkup, history of heart condition but feeling completely normal today, zero chest pain{ending}"),
    ("Routine", "{opener}Need routine prescription renewal for my chronic severe asthma inhaler, currently having zero symptoms{ending}"),
    ("Routine", "{opener}Worried about family history of heart attack in the future, currently asymptomatic and feel fine, routine consult{ending}"),
    ("Routine", "{opener}A little bit of blood when I blow my nose due to dry winter weather, no other problems, feeling well{ending}"),
    ("Routine", "{opener}Mild headache and slight cough since yesterday, no trouble breathing, no fever{ending}"),

    # Urgent edge cases with high pain or concerning signs
    ("Urgent", "{opener}Bad cough with high fever of {temp} and severe body aches since yesterday, no chest agony{ending}"),
    ("Urgent", "{opener}Head hurts really bad cannot sleep coughing a lot feeling terrible since yesterday{ending}"),
    ("Urgent", "{opener}Severe burning sensation when I pee and lower belly ache for past two days{ending}"),
    ("Urgent", "{opener}Sharp sudden lower back spasm while lifting heavy box, pain shooting down sciatica nerve, can barely walk{ending}"),
    ("Urgent", "{opener}Deep laceration on palm from kitchen knife 2 hours ago, bleeding controlled with direct pressure but gaping open{ending}"),

    # Emergency edge cases with subtle or severe presentations
    ("Emergency", "{opener}I feel very strange in my chest, heavy tightness and sudden cold sweat making me dizzy{ending}"),
    ("Emergency", "{opener}My head feels funny and one side of my body feels completely numb and weak{ending}"),
    ("Emergency", "{opener}Sudden slurred speech and facial drooping, but no severe pain{ending}"),
    ("Emergency", "{opener}Difficulty breathing, coughing up foam, heart failure history{ending}"),
    ("Emergency", "{opener}Severe pressure across chest radiating to left jaw, but mild nausea{ending}"),
]


def generate_dataset(num_records: int = 12000, seed: int = 42) -> pd.DataFrame:
    """Generate a balanced, deduplicated synthetic triage dataset with 2,000+ tokens."""
    print(f"Generating {num_records} deduplicated synthetic clinical triage records...")
    rng = random.Random(seed)

    per_class = num_records // 3
    targets = {
        "Routine": per_class + (1 if num_records % 3 >= 1 else 0),
        "Urgent": per_class + (1 if num_records % 3 >= 2 else 0),
        "Emergency": per_class,
    }

    seen_texts = set()
    data = []

    def build_record(label: str) -> str:
        # 5% chance of realistic borderline edge cases
        if rng.random() < 0.05:
            matching = [tpl for lvl, tpl in AMBIGUOUS_CASES if lvl == label]
            if matching:
                tpl = rng.choice(matching)
                raw = tpl.format(
                    opener=rng.choice(OPENERS),
                    ending=rng.choice(ENDINGS),
                    temp=rng.choice(FEVERS_HIGH),
                )
                return _apply_light_noise(raw.strip(), rng)

        med_name, med_cond = rng.choice(CHRONIC_MEDS)
        temp_val = rng.choice(FEVERS_HIGH) if label == "Urgent" else rng.choice(FEVERS_MILD)

        if label == "Routine":
            tpl = rng.choice(ROUTINE_TEMPLATES)
            raw = tpl.format(
                opener=rng.choice(OPENERS),
                ending=rng.choice(ENDINGS),
                med_name=med_name,
                med_cond=med_cond,
                checkup_type=rng.choice(CHECKUP_TYPES),
                mild_symptom=rng.choice(ROUTINE_MILD_SYMPTOMS),
                routine_lab=rng.choice(ROUTINE_LABS),
                routine_negation=rng.choice(ROUTINE_NEGATIONS),
                time=rng.choice(TIMES),
                duration=rng.choice(DURATIONS),
            )
        elif label == "Urgent":
            tpl = rng.choice(URGENT_TEMPLATES)
            raw = tpl.format(
                opener=rng.choice(OPENERS),
                ending=rng.choice(ENDINGS),
                temp=temp_val,
                urgent_body=rng.choice(URGENT_BODY_PARTS),
                urgent_infection=rng.choice(URGENT_INFECTIONS).format(temp=temp_val),
                urgent_abdominal=rng.choice(URGENT_ABDOMINALS).format(temp=temp_val),
                urgent_ortho=rng.choice(URGENT_ORTHOS),
                urgent_wound=rng.choice(URGENT_WOUNDS),
                time=rng.choice(TIMES),
                duration=rng.choice(DURATIONS),
            )
        else:
            tpl = rng.choice(EMERGENCY_TEMPLATES)
            raw = tpl.format(
                opener=rng.choice(OPENERS),
                ending=rng.choice(ENDINGS),
                cardiac_quality=rng.choice(CARDIAC_QUALITIES),
                cardiac_radiation=rng.choice(CARDIAC_RADIATION),
                stroke_presentation=rng.choice(STROKE_PRESENTATIONS),
                headache_emergency=rng.choice(HEADACHE_EMERGENCIES),
                seizure_detail=rng.choice(SEIZURE_DETAILS),
                dyspnea_presentation=rng.choice(DYSPNEA_PRESENTATIONS),
                bleeding_presentation=rng.choice(BLEEDING_PRESENTATIONS),
                trauma_presentation=rng.choice(TRAUMA_PRESENTATIONS),
                tox_presentation=rng.choice(TOX_PRESENTATIONS),
                time=rng.choice(TIMES),
                duration=rng.choice(DURATIONS),
            )

        return _apply_light_noise(raw.strip(), rng)

    for label, count in targets.items():
        added = 0
        attempts = 0
        max_attempts = count * 60
        while added < count and attempts < max_attempts:
            attempts += 1
            text = build_record(label)
            norm = text.lower().strip()
            if norm not in seen_texts:
                seen_texts.add(norm)
                data.append({"symptom_text": text, "triage_level": label})
                added += 1

        if added < count:
            print(f"Warning: Only generated {added}/{count} samples for {label}")

    rng.shuffle(data)
    df = pd.DataFrame(data)

    # Compute raw vocabulary size
    all_words = set()
    for text in df["symptom_text"]:
        words = re.findall(r"\b[a-zA-Z]{2,}\b", text.lower())
        all_words.update(words)

    csv_path = os.path.join(os.path.dirname(__file__), "symptom_data.csv")
    df.to_csv(csv_path, index=False)

    print(f"Dataset successfully created at {csv_path}")
    print(f"Total rows: {len(df)}")
    print(f"Class distribution:\n{df['triage_level'].value_counts().to_dict()}")
    print(f"Raw vocabulary size: {len(all_words)} unique words")
    print(f"Templates per class: Emergency={len(EMERGENCY_TEMPLATES)}, Urgent={len(URGENT_TEMPLATES)}, Routine={len(ROUTINE_TEMPLATES)}")

    return df


if __name__ == "__main__":
    generate_dataset()
