// Builds ferrofluid_tank/Project_Overview.docx: the full write-up of the
// virtual-to-physical shape platform project (intent, research, both routes,
// current build, procedures, materials, next steps), with the drawings embedded.
//
// Run: node ferrofluid_tank/build_project_doc.js

const fs = require("fs");
const path = require("path");
const {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, Footer, Header, HeadingLevel,
  ImageRun, LevelFormat, Packer, PageBreak, PageNumber, Paragraph, ShadingType, Table,
  TableCell, TableRow, TextRun, WidthType,
} = require("docx");

const DIR = __dirname;
const OUT = path.join(DIR, "Project_Overview.docx");
const CONTENT_W = 9360; // 6.5 in in DXA
const ACCENT = "1F4E79";
const HEAD_FILL = "DCE6F1";
const NOTE_FILL = "FFF4D6";

// ---------- text helpers ----------

// Parses **bold** and [label](url) inside a string into runs.
function rich(text, base = {}) {
  const out = [];
  const re = /\*\*(.+?)\*\*|\[(.+?)\]\((https?:\/\/[^)]+)\)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), ...base }));
    if (m[1] !== undefined) {
      out.push(new TextRun({ text: m[1], bold: true, ...base }));
    } else {
      out.push(new ExternalHyperlink({
        link: m[3],
        children: [new TextRun({ text: m[2], style: "Hyperlink", ...base })],
      }));
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), ...base }));
  return out;
}

const p = (text, opts = {}) => new Paragraph({ children: rich(text), spacing: { after: 120 }, ...opts });
const h1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
const h2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
const h3 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(text)] });
const bullet = (text, level = 0) =>
  new Paragraph({ children: rich(text), numbering: { reference: "bullets", level }, spacing: { after: 60 } });
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

let numberedRef = 0;
function numbered(items) {
  const ref = `num${numberedRef++}`;
  NUMBERING_CONFIGS.push({
    reference: ref,
    levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 540, hanging: 360 } } } }],
  });
  return items.map((t) => new Paragraph({ children: rich(t), numbering: { reference: ref, level: 0 },
    spacing: { after: 60 } }));
}

function note(text) {
  return new Paragraph({
    children: rich(text),
    shading: { type: ShadingType.CLEAR, fill: NOTE_FILL, color: "auto" },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: "E0A800", space: 6 } },
    spacing: { before: 80, after: 160 },
    indent: { left: 120, right: 120 },
  });
}

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: "A6A6A6" };
const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

// widths are relative weights; scaled to the content width
function table(headers, rows, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map((w) => Math.floor((w / total) * CONTENT_W));
  widths[widths.length - 1] += CONTENT_W - widths.reduce((a, b) => a + b, 0);
  const mkCell = (text, i, head) => new TableCell({
    borders,
    width: { size: widths[i], type: WidthType.DXA },
    shading: head ? { fill: HEAD_FILL, type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: String(text).split("\n").map((line) => new Paragraph({
      children: rich(line, head ? { bold: true, size: 19 } : { size: 19 }),
    })),
  });
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => mkCell(h, i, true)) }),
      ...rows.map((r) => new TableRow({ children: r.map((c, i) => mkCell(c, i, false)) })),
    ],
  });
}
const gap = () => new Paragraph({ children: [], spacing: { after: 80 } });

function figure(file, caption) {
  const buf = fs.readFileSync(path.join(DIR, file));
  // PNG header: width at byte 16, height at byte 20
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  const width = 624; // 6.5 in at 96 px/in
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new ImageRun({ type: "png", data: buf, transformation: { width, height: Math.round((width * h) / w) },
        altText: { title: caption, description: caption, name: file } })],
    }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
      children: [new TextRun({ text: caption, italics: true, size: 18, color: "595959" })] }),
  ];
}

const NUMBERING_CONFIGS = [
  {
    reference: "bullets",
    levels: [
      { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 540, hanging: 300 } } } },
      { level: 1, format: LevelFormat.BULLET, text: "◦", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 1080, hanging: 300 } } } },
    ],
  },
];

// ---------- content ----------

const body = [];
const add = (...xs) => xs.flat().forEach((x) => body.push(x));

// Title page
add(
  new Paragraph({ spacing: { before: 2400, after: 200 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Virtual-to-Physical Shape Platform", bold: true, size: 52, color: ACCENT })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 },
    children: [new TextRun({ text: "Project overview, design rationale, build log and next steps", size: 28, color: "404040" })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
    children: [new TextRun({ text: "First target: a virtual apple, made physical, floating and shape-changing", size: 24, italics: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1200, after: 80 },
    children: [new TextRun({ text: "Status as of October 28, 2026", size: 22 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Glass tank and frame built  ·  Lid design final  ·  Next: S1 liquid test", size: 22, color: "404040" })] }),
  pageBreak(),
);

// Contents (static list)
add(h1("Contents"));
[
  "1. Executive summary",
  "2. Intent and vision",
  "3. How the concept evolved",
  "4. Research landscape and novelty",
  "5. Route 1: self-assembling flying modules",
  "6. Route 2: magnetic liquid (focus: Scheme 2A)",
  "7. Current build: the S1 container",
  "8. S1 liquid test procedure",
  "9. Bill of materials for S1",
  "10. Looking ahead: S2 coil array",
  "11. Open items and decisions",
  "12. Glossary",
  "13. References",
  "14. Project files",
].forEach((t) => add(p(t, { spacing: { after: 40 } })));
add(pageBreak());

// 1. Executive summary
add(
  h1("1. Executive summary"),
  p("This project aims to build a platform that takes a **virtual object** and reproduces it as a **physical object in the real world**: something you can see from any angle, that **floats**, and that can **change shape** on command. The first target object is an apple."),
  p("After exploring several approaches (pin-array shape displays, continuous morphing surfaces, magnetic voxels, levitation displays), two routes were kept:"),
  bullet("**Route 1 – Self-assembling flying modules.** Many small ducted drone modules fly to positions, dock to their neighbours and become one rigid, touchable apple that flies as a single vehicle. Shape changes by undocking and re-docking modules."),
  bullet("**Route 2 – Magnetic liquid.** A blob of ferrofluid floats inside a transparent tank of density-matched liquid (Scheme 2A). Electromagnet coils around the tank hold it in place and sculpt it into an apple shape, with camera feedback."),
  p("**Current focus is Route 2, Scheme 2A**, because it is the cheapest and fastest way to get a floating, shape-changing object. The glass tank (4 × 4 × 4 in interior) and its frame are built, the lid design is final, and the next milestone is **S1: the liquid test** (density matching, neutral buoyancy, drift vs. temperature), with no coils yet."),
  note("All numbers in this document marked as estimates come from first-order calculations or typical datasheet values. They should be confirmed by the S1 and S2 measurements."),
);

// 2. Intent
add(
  h1("2. Intent and vision"),
  h2("2.1 What we want to build"),
  p("A platform that **maps virtual entities into reality**: a 3D model on a computer becomes a physical shape in front of you. The long-term qualities we are aiming for:"),
  bullet("**Physical, not an image.** A real object occupies the space, rather than a projection or hologram."),
  bullet("**Floating.** The object is suspended in space, not standing on a table."),
  bullet("**Shape-changing.** The same material can become different shapes, or morph smoothly between them."),
  bullet("**Touchable** (Route 1 goal). A hand can touch it and feel resistance."),
  h2("2.2 Why an apple first"),
  p("An apple is roughly **rotationally symmetric** around its vertical axis. That means only a few shape parameters are needed to describe it: overall size, how flattened it is, top-versus-bottom asymmetry, and the dimples at the top and bottom poles. That makes it a realistic first target for a shape-control system, while still being instantly recognisable."),
  h2("2.3 Success for the first phase"),
  bullet("A ferrofluid blob about 1.2 in across floats at the centre of the tank for 30+ minutes without touching any wall (S1, S3)."),
  bullet("Coils can switch it between sphere, ellipsoid and an apple-like shape (S4, S5)."),
);

// 3. Evolution
add(
  h1("3. How the concept evolved"),
  p("The design went through several stages. Each one taught something that shaped the next."),
  table(["Stage", "Idea", "What we learned"], [
    ["1", "**Pin-array platform.** A grid of pins rises to different heights to form a shape (like MIT inFORM).",
      "Proven technology, but only 2.5D (no overhangs or hollow shapes), stepped surfaces, and cost grows quickly with pin count."],
    ["2", "**Continuous surface.** Replace the stepped pins with one smooth face: elastic membrane over pins, a flexible plate on sparse actuators, pneumatic cells, or smart materials.",
      "A membrane over pins is the most practical, but sharp edges get smoothed out and it is still 2.5D."],
    ["3", "**3D box with magnetic control.** Shape objects inside a closed box using magnetism.",
      "Magnetic force falls off fast with distance. A static field has no strength maximum in free space, so magnetic material is always pulled toward the walls. Stable levitation needs active feedback (Earnshaw’s theorem)."],
    ["4", "**Magnetic powder or small magnetic blocks** instead of pins.",
      "Powder follows field lines and forms spikes, not precise shapes. Magnetorheological (MR) fluid can be “frozen” by a field. Soft-iron blocks stack into 2.5D columns; true 3D needs blocks that lock to each other."],
    ["5", "**A floating apple.**",
      "“Visible” and “touchable” are different problems. Acoustic-levitation displays already draw floating images; a solid floating object needs a different approach."],
    ["6", "**Two routes kept.** Route 1: flying modules (evolved from “many tiny drones” → “jet-powered” → “modules that dock into one rigid body”). Route 2: magnetic liquid in a tank or in air.",
      "Both routes separate the problems of floating and shaping. That separation is the key design idea of the project."],
  ], [8, 46, 46]),
  gap(),
);

// 4. Research
add(
  h1("4. Research landscape and novelty"),
  h2("4.1 Shape displays (pin arrays and successors)"),
  table(["Project", "Year / venue", "Key point"], [
    ["Relief (MIT)", "~2009–10", "Early motorised pin table (about 120 pins)."],
    ["inFORM (MIT Tangible Media Group)", "2013, UIST", "30 × 30 = 900 motorised pins, projector colouring, depth-camera interaction."],
    ["Physical Telepresence / TRANSFORM (MIT)", "2014", "Remote shape transmission; shape-changing furniture."],
    ["Materiable (MIT)", "2016", "Pins simulate material feel (elastic, viscous, liquid)."],
    ["shapeShift (Stanford SHAPE Lab)", "2018", "Mobile tabletop display: 12 × 24 pins, 7 mm pitch, 50 mm travel."],
    ["inFORCE (MIT)", "2019, TEI", "10 × 5 pins with closed-loop force sensing and feedback."],
    ["TRANS-DOCK (MIT)", "2020", "Interchangeable mechanical transducers docked on a pin display."],
    ["PoCoPo (Univ. of Tokyo)", "2020", "Handheld 18-pin display for VR haptics."],
    ["MagneShape", "2022, UIST", "Pins lifted by magnet patterns, no motor per pin."],
    ["SuperMagneShape", "2023, UIST demo", "Faster magnetic pattern changes using a magnetic belt conveyor."],
    ["Soft Growing Pin", "~2024", "Soft “growing” pins with much longer travel."],
    ["SHAPE-IT (UChicago AxLab)", "2024, UIST", "Text-to-shape: LLMs generate shape-display behaviours."],
    ["Shape n’ Swarm (AxLab)", "2025, UIST", "LLM-driven shape authoring with a swarm of small robots."],
    ["Pino", "2025, CHI EA", "Pins arranged on a sphere for omnidirectional shapes."],
    ["MorphPatch", "2026, arXiv", "Surface approximation plus visuo-haptic illusion for VR."],
    ["Encountered-type 3D haptic shape display", "2026, journal", "20 actuators in finger-like units to go beyond 2.5D."],
  ], [32, 18, 50]),
  gap(),
  h2("4.2 Magnetic modules, magnetic fluids and levitation"),
  table(["Area", "Examples", "Relevance"], [
    ["Programmable matter with magnets", "Robot Pebbles (MIT, ~2010, electropermanent magnets); Kubits; magnetically controlled modular cubes (IEEE 2021); distributed magnetic cuboid robots (2025); M-Blocks (2013) and ElectroVoxel (2022)*",
      "Docking and locking with electropermanent magnets (switch with a pulse, hold with zero power). Basis for Route 1 docking."],
    ["Magnetic fluids in interfaces", "inFlux (MIT, MR-fluid stiffness control); MR-fluid tactile displays; Ferrolic (Zelf Koelman); Ferrotank (Aalto); Northwestern ferrofluid art display",
      "Coil arrays shaping ferrofluid behind glass already work in art pieces. Basis for Route 2."],
    ["Coil arrays steering particles", "10-coil system for nanoparticle swarms (Advanced Intelligent Systems, 2025); hexapole magnetic tweezers; OctoMag (ETH)",
      "Field superposition, coil layout and control math for Route 2."],
    ["Levitation displays", "Acoustic trap display (Hirayama et al., Nature 2019); photophoretic trap display (Smalley et al., Nature 2018); ZeroN (MIT, 2011)",
      "Floating visual 3D images, small and not solid."],
    ["Modular / swarm aerial robots", "ModQuad (UPenn, 2018); Distributed Flight Array (ETH, 2011); DRAGON (Univ. of Tokyo); Neural-Swarm (Caltech, 2020); BitDrones (2016); GridDrones (2018); AIREAL (Disney, 2013)",
      "Mid-air docking, downwash-aware close formation flight, touchable drone displays."],
  ], [22, 45, 33]),
  p("* M-Blocks and ElectroVoxel are from background knowledge and were not confirmed in this project’s searches."),
  h2("4.3 Where this project is new"),
  bullet("**Route 2:** making a magnetic liquid **float and actively form a chosen 3D shape inside a closed volume** (rather than spikes on a surface) was not found as an existing system."),
  bullet("**Route 1:** flying modules that **self-assemble into a volumetric (not flat) shape**, using **aligned vertical ducts** so stacked layers do not blow on each other. Existing mid-air docking work builds flat structures."),
  bullet("**Possible variant:** passive soft-iron blocks positioned by external coils and then fixed in place by **locally stiffening MR fluid**, avoiding locks between blocks."),
  note("These novelty statements come from a limited set of web searches, not a formal literature or patent search. Before publishing or filing, do a systematic search of CHI, UIST, TEI, ICRA and patent databases."),
);

// 5. Route 1
add(
  h1("5. Route 1: self-assembling flying modules"),
  h2("5.1 Concept"),
  p("Small drone modules each fly to an assigned position, dock to the neighbouring modules and lock. Once locked, the whole apple is **one rigid flying vehicle**, controlled as one aircraft. To change shape, some modules unlock, fly to new positions and lock again."),
  h2("5.2 Why not “countless tiny drones” or onboard jets"),
  bullet("**Size:** the smallest mature indoor drones are about 9 cm across, larger than an apple, so a drone-built apple must be scaled up to roughly 40 cm or more."),
  bullet("**Downwash:** every hovering vehicle pushes air down. Drones stacked above each other disturb the ones below. Jets do not fix this; they concentrate the same momentum into a faster, narrower stream."),
  bullet("**Jets are inefficient for hovering:** a small, fast exhaust needs far more power than a propeller for the same lift, and is louder and hotter."),
  bullet("**Touch:** a free-flying drone gets pushed away by a hand, and open propellers are unsafe. Locking modules into one rigid body solves both."),
  h2("5.3 Module design (first version)"),
  table(["Item", "Specification", "Reason"], [
    ["Shape", "80 mm cube", "Cubes tile in all six directions; 80 mm is the smallest size that fits four ducted 31 mm props."],
    ["Propulsion", "4 vertical ducts (~35 mm), 31 mm props, 0802-class 1S brushless motors", "Tiny-Whoop-class ducted design; props fully enclosed."],
    ["Duct rule", "Every module has ducts at identical positions", "Stacked modules form continuous vertical air channels, so upper layers blow through lower ones instead of onto them."],
    ["Faces", "Six identical, genderless faces", "Any face can dock to any face."],
    ["Alignment", "One cone pin + one cone socket per face, diagonal", "Pulls docking error under ~1 mm."],
    ["Holding", "4 magnets per face, alternating N/S; electropermanent magnets in the final version", "EPMs switch with a pulse and hold with zero power."],
    ["Electrical", "4 spring pogo pins + 4 pads per face", "Share battery power and a CAN bus after docking."],
    ["Flight control", "Crazyflie open-source firmware (e.g. Crazyflie Bolt board)", "Built-in swarm control and positioning support."],
    ["Positioning", "Motion capture or Lighthouse", "Docking needs millimetre accuracy."],
    ["Sensing / display", "Hall sensor per face; RGB LEDs on side faces", "Detect lock state; colour the assembled apple red."],
  ], [16, 40, 44]),
  gap(),
  h3("Mass and thrust budget (estimate)"),
  table(["Part", "Mass"], [
    ["Frame + ducts (SLS nylon)", "7 g"], ["4 motors + props", "9 g"], ["Flight controller, ESCs, radio", "4 g"],
    ["1S 450 mAh battery", "12 g"], ["6 docking faces", "10 g"], ["LEDs, Hall sensors, wiring", "3 g"],
    ["**Total**", "**~45 g**"],
  ], [70, 30]),
  gap(),
  bullet("Maximum thrust about 100–120 g, thrust-to-weight about 2.3–2.6."),
  bullet("Solo hover time about 4–6 minutes. For demos, the assembled apple can be powered by a tether through the bottom module and shared over the pogo pins."),
  bullet("Scale: a 40 cm apple needs about 60–80 modules; a 1 m apple about 500. **First target: 40 cm.**"),
  h3("Assembled-structure design rules"),
  bullet("**Lift modules vs. shell modules:** only some modules (e.g. a core layer) need to produce lift after docking; outer modules can stop their motors and just form the surface."),
  bullet("**Central thrust allocation:** after docking, one controller distributes thrust across all active motors."),
  bullet("**Touch feedback:** the rigid body can push back against a hand, simulating weight and firmness."),
  h2("5.4 Development steps"),
  ...numbered([
    "Single 80 mm ducted module that hovers stably.",
    "Two modules docking side by side in mid-air (reproduce ModQuad).",
    "Two modules docking vertically: test the aligned-duct air channel.",
    "Eight modules forming a 2 × 2 × 2 cube: fly as one body, then test unlock, regroup and touch.",
  ]),
  h2("5.5 Main risks"),
  bullet("Short endurance; docking accuracy; mass growth from docking hardware; safety of a large flying object (test inside a cage or net)."),
);

// 6. Route 2
add(
  h1("6. Route 2: magnetic liquid (focus: Scheme 2A)"),
  h2("6.1 Core idea"),
  p("Use ferrofluid as the shapeable material and **solve floating and shaping separately**. If magnets had to hold the liquid up and sculpt it at the same time, the two fields would fight each other."),
  h2("6.2 Scheme 2A: floating in liquid (current focus)"),
  table(["Item", "Choice", "Why"], [
    ["Ferrofluid", "Oil-based Ferrotec EFH1, density about 1.21 g/cm³ (confirm on the bottle/datasheet)", "Does not mix with water-based liquids; widely available."],
    ["Surrounding liquid", "About 80% glycerol + 20% distilled water by weight, tuned by drop test", "Density about 1.21 to match; viscosity about 60 mPa·s damps motion; thermal expansion closer to the ferrofluid than salt water."],
    ["Why it floats", "Ferrofluid and solution are immiscible and have equal density", "Buoyancy equals weight, so the blob neither sinks nor rises (like a fish holding depth)."],
  ], [18, 42, 40]),
  gap(),
  note("Glycerol (also called glycerin, propane-1,2,3-triol, C₃H₈O₃) is an alcohol, not an oil. It mixes fully with water. Cooking oil cannot replace it: oil-based ferrofluid dissolves into cooking oil, and cooking oil (about 0.92 g/cm³) is far lighter than ferrofluid. For practice runs only, sugar water (about 45% sugar by weight) can reach the right density; saturated salt water (about 1.20) is marginal."),
  h3("Two problems to manage"),
  bullet("**Temperature drift.** The two liquids expand differently with temperature, so a temperature change creates a small density mismatch and the blob slowly sinks or rises. Estimate: the coil fields planned for shaping can compensate a few °C of mismatch, so holding the liquid within about ±0.5 °C is enough."),
  bullet("**Wall staining.** Oil-based ferrofluid stains glass on contact. Keep the glass hydrophilic (thoroughly cleaned so the water solution wets it) and never let the blob touch a wall."),
  h3("Improvement: a gentle density gradient"),
  p("If the whole tank has one uniform density, the blob has no restoring force in the vertical direction. Layering a slightly denser solution at the bottom and a slightly lighter one above creates a smooth gradient. The blob then **settles at the height where densities match**: if it sinks, the heavier liquid pushes it back up, and if it rises, it falls back. Temperature changes then only shift its height slightly. Worth testing during the S1 vial tests."),
  h2("6.3 Magnetic field requirements (estimates)"),
  bullet("Because the ferrofluid–solution interface tension is low, about **1–3 mT** at the blob is enough to deform a 30 mm blob noticeably. Power needs are therefore modest."),
  bullet("Above about **5 mT**, ferrofluid tends to grow spikes (Rosensweig instability), so normal operation stays in the weak-field range."),
  bullet("At 1–3 mT the available magnetic force is enough to counter a few °C of buoyancy mismatch, so position and shape control can share the same field range."),
  h2("6.4 Coil layout (26 coils)"),
  table(["Coil group", "Count", "Role"], [
    ["Corner coils, one at each cube corner pointing to the centre (OctoMag-style)", "8", "Hold position; stretch or flatten the whole blob."],
    ["Top and bottom 3 × 3 arrays", "18", "Detail at the poles: the apple’s top and bottom dimples."],
    ["Four side faces", "0", "Kept clear for viewing and cameras."],
  ], [55, 10, 35]),
  gap(),
  bullet("Coils (first estimate): soft-iron core 10–15 mm diameter, about 500 turns, 1–2 A peak, 5–15 W each. Aluminium or plastic frame only (no steel). Coils on an aluminium heat-sink frame with fans, air-gapped from the tank."),
  bullet("**Apple shaping strategy:** side/corner coils strengthen the field around the equator (flattened shape); reversed centre coils in the top/bottom arrays create weak-field spots at the poles (dimples); optionally a strong local field at the top centre pulls a small spike as a stem."),
  h2("6.5 Sensing"),
  bullet("2–3 global-shutter cameras with **infrared (850 nm) backlight panels** opposite. The opaque ferrofluid shows as a crisp black silhouette, and IR keeps the visible lighting free for display."),
  bullet("Silhouettes from 2–3 views give a 3D reconstruction (visual hull) at about 60 fps: centroid and shape parameters."),
  bullet("Field calibration: a 3-axis Hall sensor scanned through the tank to map the field of each coil (current-to-field model)."),
  h2("6.6 Control architecture"),
  table(["Loop", "Rate", "Job"], [
    ["Current loop", "kHz, on the microcontroller", "Hold each coil at its commanded current."],
    ["Position loop", "30–60 Hz", "Keep the blob centroid at the tank centre."],
    ["Shape loop", "30–60 Hz", "Drive low-order spherical-harmonic shape parameters toward the target (for an apple about 3: flattening, top/bottom asymmetry, pole dimples)."],
  ], [18, 22, 60]),
  gap(),
  bullet("Each cycle solves a small optimisation: meet the position and shape requirements with minimum total power, within coil current limits (coil fields add linearly)."),
  bullet("**Virtual-to-physical pipeline:** 3D apple model → fit to low-order spherical harmonics → target shape → controller drives the blob toward it."),
  bullet("Expected dynamics in glycerol: the blob moves a few mm per second and changes shape in 0.1–1 s, which suits closed-loop control."),
  h2("6.7 Full-system cost estimate (Scheme 2A, all stages)"),
  table(["Part", "Specification", "Estimate"], [
    ["Tank", "Low-iron glass cube, hydrophilic treatment", "$30–80"],
    ["Ferrofluid", "Oil-based, 50–125 mL", "$50–100"],
    ["Glycerol", "USP, 1 gallon", "$25–50"],
    ["Coils", "26 self-wound soft-iron-core coils", "$100–150"],
    ["Drivers", "26 H-bridges with current sense (e.g. DRV8874)", "$150–200"],
    ["Controller", "Teensy 4.1 or STM32", "$30"],
    ["Power supply", "24 V, 30 A", "$60"],
    ["Cameras", "2–3 global-shutter IR cameras + IR backlights", "$150–400"],
    ["Calibration", "3-axis magnetometer + small XYZ stage", "$50"],
    ["Temperature", "Probe, logger, heater, insulation", "$30–80"],
    ["**Total**", "", "**about $700–1,100**"],
  ], [20, 55, 25]),
  gap(),
  h2("6.8 Development stages"),
  table(["Stage", "Content", "Pass criterion"], [
    ["**S1 Liquid test** (next)", "No coils. Match density, check floating and wall staining, measure drift vs. temperature.", "Blob floats 30+ min, drifts < 3/16 in in 30 min, never touches a wall."],
    ["S2 Single face", "Bottom 3 × 3 coil array, field calibration, first deformation.", "Controlled stretching or flattening is visible."],
    ["S3 Hover", "8 corner coils + cameras, closed loop.", "Blob held at centre long-term, error < 2 mm."],
    ["S4 Shape control", "Add top and bottom arrays.", "Switch back and forth between sphere and ellipsoid."],
    ["S5 Apple", "Target shape from a 3D model.", "Recognisable apple; smooth morphing."],
  ], [20, 45, 35]),
  gap(),
  h2("6.9 Risks"),
  table(["Risk", "Mitigation"], [
    ["Buoyancy drift from temperature", "Insulation and temperature control; matched-expansion liquids; density gradient; position loop."],
    ["Ferrofluid staining the glass", "Hydrophilic glass; anti-collision limits in control."],
    ["Spikes at high field", "Keep fields under about 3–5 mT."],
    ["Blob breaking into droplets", "Avoid sudden field changes; ramp currents smoothly."],
    ["Ferrofluid distorts the field (model error)", "Rely on vision feedback; learn a data-driven model later."],
    ["Ferrofluid is black", "Accept for V1; its mirror-like surface can catch red light for a red sheen."],
  ], [35, 65]),
  gap(),
  h2("6.10 Scheme 2B: floating in air (later)"),
  p("An apple-shaped elastic silicone skin filled with MR fluid or ferrofluid around a permanent-magnet core. An electromagnet with Hall-sensor feedback levitates the whole object; a ring of coils deforms the skin. Much harder, because the shaping coils disturb the levitation field and moving liquid shifts the centre of mass."),
);

// 7. Current build
add(
  h1("7. Current build: the S1 container"),
  p("The tank is a small sealed glass “aquarium” with a removable lid. It is designed to be reused unchanged when coils are added in S2–S5. **The glass panels and the frame are built.**"),
  h2("7.1 Glass panels"),
  table(["Part", "Name", "Size (in)", "Qty"], [
    ["A", "Bottom", "4 3/8 × 4 3/8 × 3/16", "1"],
    ["B", "Front / back walls", "4 3/8 × 4 × 3/16", "2"],
    ["C", "Left / right walls", "4 × 4 × 3/16", "2"],
  ], [10, 30, 45, 15]),
  gap(),
  bullet("All four walls stand on the bottom panel; the front and back walls overlap the side walls. Interior **4 × 4 × 4 in** (about 64 in³, 1.05 L); outside about 4 3/8 × 4 3/8 × 4 1/2 in including the lid."),
  bullet("Low-iron (ultra-clear) glass for clean camera silhouettes; acrylic avoided because the ferrofluid’s oil carrier can craze it. Tolerance ±1/32 in; all edges seamed; aquarium silicone applied on the outside with minimal inside seams."),
  bullet("A 1.2 in blob at the centre sits about 1.4 in from every wall."),
  ...figure("glass_panels.png", "Figure 1. Glass panel shop drawing (inches)."),
  h2("7.2 Lid"),
  table(["Hole", "Use", "Centre X, Y (in)", "Machining"], [
    ["H1", "Expansion tube (and temperature probe)", "(3.625, 3.625)", "Ø21/32 in (16.7 mm) through hole for the 16 mm OD glass tube; seal with silicone"],
    ["H2", "Fill port", "(0.750, 3.625)", "#7 drill (0.201 in), tap 1/4\"-20 UNC; nylon screw plug + O-ring"],
  ], [8, 27, 20, 45]),
  gap(),
  bullet("1/4 in Delrin (POM), 4 3/8 × 4 3/8 in, ±1/64 in. Origin at the bottom-left corner of the top view."),
  bullet("Holes are 3/4 in from the edges so the larger 16 mm tube clears the inner glass wall. Front corners reserved for future sensor ports; the centre stays clear for the future top coil array."),
  bullet("**No separate temperature-probe hole.** The probe goes down through the open top of the expansion tube."),
  bullet("The lid is not glued. The frame clamps it onto a 1/16 in silicone gasket, so it can be removed."),
  bullet("Underside (wetted face) flat and smooth; deburr all holes."),
  ...figure("lid_holes.png", "Figure 2. Lid hole drawing (inches)."),
  h2("7.3 Expansion tube and temperature probe"),
  bullet("Glass tube **16 mm OD**, about 4 in tall above the lid. Its inner diameter is assumed to be about 13 mm (1.5 mm wall) and **needs to be measured**."),
  bullet("The tube holds the tank’s only free liquid surface, so the tank can be completely filled without trapped air. With a 13 mm bore, a 10 °C rise lifts the level in the tube by about 1.4 in."),
  bullet("The temperature probe passes down the tube, with its tip about 1 in below the lid. It must be **at least 6 in long** and thinner than the tube bore (a 1/8 in thermocouple or a 6 mm DS18B20 both fit)."),
  bullet("Do not seal the tube top (it must breathe for expansion), but cover it with film with a small slit for the probe cable, to stop water evaporating and shifting the density."),
  ...figure("tank_render.png", "Figure 3. Assembled (filled) and exploded views of the tank. Frame not shown."),
);

// 8. Procedure
add(
  h1("8. S1 liquid test procedure"),
  p("S1 uses no coils. It verifies three things: **the tank does not leak, the density can be matched, and the ferrofluid floats without touching the walls.** It also measures how fast the blob drifts as temperature changes, which sets the temperature-control and coil-force requirements for later stages."),
  h2("Step 1. Leak test and cleaning (1–2 days)"),
  ...numbered([
    "Fill with tap water, clamp the lid, stand the tank on paper towels for 24 hours, and check every seam and the gasket.",
    "Empty, wash with dish soap, wipe with isopropyl alcohol, rinse with distilled water. Do not touch the inner glass afterwards.",
    "Check hydrophilicity: pour distilled water in and out. The glass should keep an even film, not beads of water. If it beads, clean again.",
  ]),
  h2("Step 2. Density matching (in small vials, not in the tank)"),
  ...numbered([
    "Mix about 100 mL of 80% glycerol / 20% distilled water by weight. Stir and let it reach room temperature.",
    "Put one drop of ferrofluid in. If it sinks, add a little glycerol; if it rises, add a little water.",
    "Repeat until the drop hovers mid-vial for 10+ minutes. Record the ratio and the temperature.",
    "Optionally test the density-gradient method in a vial.",
    "Mix about 1.3 L at the final ratio. Let it stand overnight (or vacuum-degas) to remove bubbles.",
  ]),
  h2("Step 3. Temperature probe preparation"),
  bullet("Fit the probe down the expansion tube so its tip sits about 1 in below the lid. Use a probe at least 6 in long."),
  h2("Step 4. Filling and injecting the ferrofluid"),
  note("Revised method: H2 is near a corner (its centre is 9/16 in from the inner walls), so a needle through H2 cannot reach the tank centre and would release ferrofluid near a wall. Inject with the lid off instead."),
  ...numbered([
    "With the lid off, fill the tank with solution through a tube reaching the bottom, slowly, to avoid bubbles.",
    "Lower a long blunt needle straight down to the centre and **slowly** inject about 14 mL of ferrofluid to form a blob about 1.2 in across.",
    "Let the liquid dome slightly above the rim. Slide the lid on from one side to push out excess liquid and air, then clamp it with the frame.",
    "Tilt the tank so the H1 corner is highest. Top up through H2 until the level is about 1 in up the expansion tube and no bubbles remain, then fit the H2 plug.",
  ]),
  h2("Step 5. Drift observation"),
  bullet("Put the tank in a foam box (1 in XPS walls) with a clear front window. Run the expansion tube and probe cable out through the top."),
  bullet("Tape 1/8 in grid paper on the outside of the back glass. Mount a phone on a tripod facing the window."),
  bullet("Log the liquid temperature every minute (plus room temperature on a second channel). Record a 1–2 hour time-lapse."),
  bullet("Keep the box away from windows, heaters and air vents."),
  bullet("**Pass:** drift < 3/16 in in 30 minutes, no wall contact. **Steady sinking:** add glycerol. **Steady rising:** add water."),
  ...figure("s1_setup.png", "Figure 4. S1 Step 5 drift-observation setup (inches)."),
);

// 9. BOM
add(
  h1("9. Bill of materials for S1"),
  p("Glass tank, lid, frame and glass tube are already on hand and not listed. Prices are rough estimates; confirm on each page before ordering."),
  h2("9.1 Liquids and ferrofluid"),
  table(["Item", "Recommended listing", "Qty", "Note"], [
    ["Ferrofluid (EFH1)", "[CMS Magnetics EFH series 60 mL (Amazon)](https://us.amazon.com/CMS-Magnetics-Ferrofluid-Magnetism-Education/dp/B008H40M72)", "2 bottles", "Confirm the page says EFH1. Alternatives: [Amazing Magnets 125 mL](https://amazingmagnets.com/FERROFLUID-0125-efh1-magnetic-domain-visualiztion-fluid) (about $53), [CMS 1 oz kit](https://www.amazon.com/CMS-MAGNETICS-Ferrofluid-Education-Classroom/dp/B09ZYRQLWY)"],
    ["Glycerol, USP 99.7%", "[ChemWorld USP Glycerin 1 gal (Amazon)](https://www.amazon.com/ChemWorld-Glycerin-USP-Liquid-Gallon/dp/B008TVO2Z6)", "1 gallon", "Alternatives: [SMPLY](https://www.amazon.com/SMPLY-99-7-Vegetable-Glycerin-Gallon/dp/B000RT9JGK), [POSCO Naturals](https://www.amazon.com/Vegetable-Glycerine-99-7-USP-Kosher/dp/B00DL4Y63Y). Pure glycerin only, one brand and batch."],
    ["Distilled water", "[Pure Life 1 gal (Amazon)](https://www.amazon.com/Pure-Life-Distilled-Water-Gallon/dp/B0BFK1C5LB)", "2 gallons", "A local store is much cheaper (about $1.30/gal). Not tap or purified water."],
  ], [17, 38, 12, 33]),
  gap(),
  h3("How much glycerol?"),
  bullet("One fill: about 1.3 L of solution, containing about 1.0 L (1.26 kg) of glycerol. Vial tests: about 0.12 L. **First round: about 1.1 L of glycerol**, under a third of a gallon."),
  bullet("Still buy **1 gallon**: enough for about three fills (re-fills after contamination or re-matching), extra for the density-gradient method, and a single batch keeps the ratio valid. The minimum sensible size is half a gallon (64 oz); a quart is not enough for one fill."),
  h2("9.2 Weighing and mixing"),
  table(["Item", "Specification", "Qty", "Estimate"], [
    ["Precision scale", "0.01 g, 500 g capacity", "1", "$15–25"],
    ["Kitchen scale", "0.1 g, 3 kg+ (for the 1.3 L batch)", "1", "$15"],
    ["Glass vials", "About 100 mL, borosilicate, with lids", "4", "$12"],
    ["Beaker / measuring jug", "2 L glass", "1", "$15"],
    ["Glass stirring rod", "8 in+", "1", "$5"],
    ["Transfer pipettes", "3 mL", "1 pack", "$6"],
    ["Syringes", "20 mL", "2", "$8"],
    ["Blunt needles", "16 G, 4 in long", "2", "$8"],
    ["Silicone tubing", "1/4 in ID, 3 ft (bottom filling)", "1", "$6"],
    ["Funnel", "Plastic", "1", "$3"],
    ["Vacuum chamber + pump (optional)", "2 gallon, for degassing", "1 set", "$60–90"],
  ], [30, 40, 12, 18]),
  gap(),
  h2("9.3 Lid fittings and temperature"),
  table(["Item", "Specification", "Qty", "Estimate"], [
    ["Nylon screw", "1/4\"-20 × 1/2 in (H2 plug)", "2", "$3"],
    ["O-ring", "AS568-010, Viton", "2–3", "$5"],
    ["Silicone gasket sheet", "1/16 in (if not on hand)", "1", "$10"],
    ["Aquarium silicone", "100% silicone, small tube", "1", "$8"],
    ["Temperature probe", "K-type thermocouple, 1/8 in sheath, **6 in+ long**", "2 (liquid + room)", "$15"],
    ["Temperature logger", "2-channel K-type with SD or USB logging", "1", "$40–80"],
    ["Sealing film", "Parafilm or similar, for the tube top", "1 roll", "$10"],
  ], [26, 44, 14, 16]),
  gap(),
  h2("9.4 Insulation box and recording"),
  table(["Item", "Specification", "Qty", "Estimate"], [
    ["XPS foam board", "1 in thick, 2 × 4 ft", "1", "$15"],
    ["Foam adhesive or foil tape", "", "1", "$8"],
    ["Clear acrylic", "1/16 in, 5 × 5 in (front window)", "1", "$6"],
    ["Grid paper", "1/8 in grid, printed", "2 sheets", "—"],
    ["Phone tripod", "With phone clamp", "1", "$15"],
    ["Spacer block", "Wood or plastic, about 1 in", "1", "—"],
  ], [30, 44, 12, 14]),
  gap(),
  h2("9.5 Cleaning and protection"),
  table(["Item", "Specification", "Qty", "Estimate"], [
    ["Isopropyl alcohol", "91%+", "1 pint", "$5"],
    ["Mineral spirits", "For ferrofluid spills (oil-based; water will not remove it)", "1 small", "$8"],
    ["Nitrile gloves", "", "1 box", "$10"],
    ["Lint-free wipes, paper towels, bench paper", "", "Some", "$8"],
  ], [34, 44, 10, 12]),
  gap(),
  p("**S1 total:** roughly $350–420 without the vacuum chamber, $410–510 with it (glass tube already on hand)."),
);

// 10. S2
add(
  h1("10. Looking ahead: S2 coil array"),
  p("These parts have longer lead times and can be ordered during S1."),
  table(["Item", "Specification", "Qty"], [
    ["Soft-iron cores", "1/2 in 1018 steel or pure iron rod, cut to 1 1/2 in", "9 (+2–3 spare)"],
    ["Magnet wire", "24 AWG", "1 lb"],
    ["Coil bobbins", "3D printed", "9"],
    ["H-bridge drivers", "With current sense, e.g. DRV8874", "9"],
    ["Power supply", "24 V, 10 A", "1"],
    ["Microcontroller", "Teensy 4.1", "1"],
    ["3-axis magnetometer", "MLX90393", "1"],
    ["Aluminium plate", "Coil mounting and heat sinking", "1"],
  ], [28, 52, 20]),
  gap(),
);

// 11. Open items
add(
  h1("11. Open items and decisions"),
  table(["Item", "Status / action"], [
    ["Expansion tube inner diameter", "Assumed about 13 mm. Measure and update the drawings if different."],
    ["Frame design and lid clamping", "Frame is built but not documented here. Add its geometry to the drawings; confirm it presses the lid evenly onto the gasket."],
    ["Temperature probe", "Choose a 1/8 in thermocouple or a 6 mm DS18B20, at least 6 in long."],
    ["Density gradient", "Try in the vial tests; decide whether to fill the tank in two layers."],
    ["Injection method", "Use the lid-off injection from Step 4 (the S1 setup drawing still shows the H2 plug, which is correct for the final state)."],
    ["Ferrofluid quantity on Amazon", "Amazon has no 125 mL size; buy 2 × 60 mL or use Amazing Magnets."],
    ["Route 1 timeline", "Not started. First step would be a single 80 mm ducted module."],
    ["Novelty check", "Do a formal literature and patent search before publishing or filing."],
  ], [32, 68]),
  gap(),
);

// 12. Glossary
add(
  h1("12. Glossary"),
  table(["Term", "Meaning"], [
    ["Shape display", "A device that forms physical shapes, usually with an array of moving pins."],
    ["2.5D", "Height-map shapes: every point has one height, so no overhangs or hollows."],
    ["Ferrofluid", "A liquid carrying magnetic nanoparticles; it is pulled toward strong magnetic fields."],
    ["MR fluid", "Magnetorheological fluid: becomes nearly solid when a magnetic field is applied."],
    ["Glycerol / glycerin", "Propane-1,2,3-triol, C₃H₈O₃. An alcohol that mixes fully with water. Not an oil."],
    ["Neutral buoyancy", "Equal density to the surrounding liquid, so the object neither sinks nor rises."],
    ["Electropermanent magnet (EPM)", "A magnet switched on or off by a short current pulse, holding with no power."],
    ["Rosensweig instability", "Spikes forming on ferrofluid in a strong field perpendicular to its surface."],
    ["Earnshaw’s theorem", "Static magnetic fields alone cannot hold an object in stable levitation; active feedback is needed."],
    ["Visual hull", "A 3D shape reconstructed by intersecting silhouettes from several cameras."],
    ["Spherical harmonics", "A set of basic shape patterns on a sphere; a few of them describe an apple-like shape."],
    ["Downwash", "Air pushed downward by a hovering vehicle’s rotors."],
  ], [28, 72]),
  gap(),
);

// 13. References
add(
  h1("13. References"),
  h3("Shape displays"),
  bullet("[inFORCE – MIT Tangible Media](https://tangible.media.mit.edu/project/inforce); [inFORCE – MIT DSpace](https://dspace.mit.edu/handle/1721.1/138021); [inFORCE – UChicago AxLab](https://www.axlab.cs.uchicago.edu/projects/inforce)"),
  bullet("[PoCoPo](https://paper.nweon.com/1336)"),
  bullet("[MagneShape](https://dl.acm.org/doi/10.1145/3526113.3545645); [SuperMagneShape](https://dl.acm.org/doi/abs/10.1145/3586182.3615768)"),
  bullet("[Soft Growing Pin](https://par.nsf.gov/biblio/10543646-soft-growing-pin-high-extension-shape-changing-displays); [ProgrammableGrass](https://arxiv.org/pdf/2403.12387)"),
  bullet("[Pino](https://dl.acm.org/doi/10.1145/3706599.3721179); [Color and texture-changeable modules](https://dl.acm.org/doi/10.1145/3706599.3721195)"),
  bullet("[SHAPE-IT](https://www.axlab.cs.uchicago.edu/projects/shape-it); [AxLab publications](https://www.axlab.cs.uchicago.edu/publications)"),
  bullet("[MorphPatch](https://arxiv.org/pdf/2609.00371); [Encountered-type 3D haptic shape display](https://doi.org/10.1177/21695172261477712) (2026 links not opened or verified)"),
  bullet("[shapeShift](https://www.researchgate.net/publication/320545116_shapeShift_A_Mobile_Tabletop_Shape_Display_for_Tangible_and_Haptic_Interaction)"),
  h3("Magnetic modules and fluids"),
  bullet("[Knaian, Electropermanent magnetic connectors and actuators (thesis)](https://cba.mit.edu/docs/theses/10.06.knaian.pdf); [One-centimetre modules for programmable matter](https://cba.mit.edu/docs/papers/10.05.knaian.ICRA.pdf)"),
  bullet("[Kubits](https://www.researchgate.net/publication/343446844_Kubits_Solid-State_Self-Reconfiguration_With_Programmable_Magnets); [Magnetically controlled modular cubes](https://ieeexplore.ieee.org/document/9573309/); [Distributed magnetic cuboid robots](https://link.springer.com/article/10.1007/s11721-025-00255-0)"),
  bullet("[inFlux](https://www.media.mit.edu/projects/influx/overview/); [MR-fluid haptic display with changeable hardness](https://dl.acm.org/doi/10.1145/3562939.3565673)"),
  bullet("[Coil system for nanoparticle swarms (2025)](https://advanced.onlinelibrary.wiley.com/doi/10.1002/aisy.202400462); [Hexapole particle-swarm manipulation](https://par.nsf.gov/servlets/purl/10173593)"),
  bullet("[Ferrolic](https://thefinchandpea.com/tag/ferrolic/); [Ferrotank](https://aaltodoc.aalto.fi/items/551e100d-0e67-40a1-bf9c-febf8995baba); [Northwestern ferrofluid art display](https://hades.mech.northwestern.edu/index.php/Ferrofluid_Art_Display)"),
  h3("Suppliers"),
  bullet("[Amazing Magnets ferrofluid](https://amazingmagnets.com/additional-products/ferrofluid/); [First4Magnets EFH1](https://www.first4magnets.com/us/product/efh1-ferrofluid-magnetic-liquid-science-art-20729); [Fisher Scientific EFH1 1 L](https://www.fishersci.com/shop/products/NC3405204/NC3405204)"),
  bullet("[ChemWorld Glycerin USP (direct)](https://www.chemworld.com/One-Gallon-Glycerin-USP-p/cw-glycerinusp-1.htm); [Walmart glycerin](https://www.walmart.com/c/kp/glycerin-gallon); [Walmart distilled water](https://www.walmart.com/ip/17501951806)"),
);

// 14. Files
add(
  h1("14. Project files"),
  p("All drawings are generated by Python scripts in the repository, branch claude/focused-lamport-5wy3hk, folder ferrofluid_tank/. Change a parameter and re-run to update a drawing. Drawing labels are in Chinese."),
  table(["File", "Content"], [
    ["glass_panels.py / .png", "Glass panel shop drawing (parameters INNER, T)."],
    ["lid_holes.py / .png", "Lid hole drawing (H1, H2, edge offset)."],
    ["tank_render.py / .png", "3D assembled and exploded views."],
    ["s1_setup.py / .png", "S1 Step 5 drift-observation setup and checklist."],
    ["build_project_doc.js", "Generates this document (Project_Overview.docx)."],
  ], [35, 65]),
);

// ---------- document ----------

const doc = new Document({
  creator: "Project team",
  title: "Virtual-to-Physical Shape Platform – Project Overview",
  styles: {
    default: { document: { run: { font: "Calibri", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, color: ACCENT, font: "Calibri" },
        paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0,
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "9DC3E6", space: 4 } } } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, color: ACCENT, font: "Calibri" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 23, bold: true, color: "404040", font: "Calibri" },
        paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 2 } },
    ],
  },
  numbering: { config: NUMBERING_CONFIGS },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 },
      margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: "Virtual-to-Physical Shape Platform · Project Overview", size: 16, color: "808080" })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], size: 16, color: "808080" })] })] }) },
    children: body,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log(OUT);
});
