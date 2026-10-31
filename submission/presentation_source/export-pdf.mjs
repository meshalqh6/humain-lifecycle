import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire,registerHooks} from 'node:module';
import {inflateSync} from 'node:zlib';
import {pathToFileURL,fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const BUILD=path.join(ROOT,'tmp/presentation-build');
const MOD=process.env.RUNTIME_NODE_MODULES || 'C:/Users/mesha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const req=createRequire(path.join(MOD,'__runtime__.cjs'));
// Supply missing standard-font aliases without changing the bundled runtime.
// Actual slide text uses the requested, locally registered Inter font.
await fs.mkdir(path.join(BUILD,'standard-fonts'),{recursive:true});
const aliases={Helvetica:'Helvetica',HelveticaBold:'Helvetica-Bold',HelveticaOblique:'Helvetica-Oblique',HelveticaBoldOblique:'Helvetica-BoldOblique',Courier:'Courier',CourierBold:'Courier-Bold',CourierOblique:'Courier-Oblique',CourierBoldOblique:'Courier-BoldOblique',TimesRoman:'Times-Roman',TimesBold:'Times-Bold',TimesItalic:'Times-Italic',TimesBoldItalic:'Times-BoldItalic',Symbol:'Symbol',ZapfDingbats:'ZapfDingbats'};
for(const [alias,name] of Object.entries(aliases)){
 const encoded=JSON.parse(await fs.readFile(path.join(MOD,'@pdf-lib/standard-fonts/lib',name+'.compressed.json'),'utf8'));
 const f=JSON.parse(inflateSync(Buffer.from(encoded,'base64')).toString());
 const data={name,bbox:f.FontBBox,ascender:f.Ascender||800,descender:f.Descender||-200,xHeight:f.XHeight||500,capHeight:f.CapHeight||700,glyphNames:f.CharMetrics.map(c=>c.N).join(' '),glyphWidths:f.CharMetrics.map(c=>c.WX),kernPairs:[]};
 await fs.writeFile(path.join(BUILD,'standard-fonts',alias+'.json'),JSON.stringify(data));
}
registerHooks({resolve(specifier,context,next){
 if(specifier.startsWith('#standard-fonts/'))return {url:pathToFileURL(path.join(BUILD,'standard-fonts',specifier.slice(16)+'.json')).href,shortCircuit:true};
 return next(specifier,context);
}});
try{
 const {PresentationFile,FileBlob,registerPdfFontFace}=await import(pathToFileURL(req.resolve('@oai/artifact-tool')).href);
 const {FontLibrary}=await import(pathToFileURL(path.join(MOD,'@oai/artifact-tool/node_modules/skia-canvas/lib/index.mjs')).href);
 FontLibrary.use('Inter',['Inter-Regular.ttf','Inter-Medium.ttf','Inter-Bold.ttf'].map(f=>path.join(ROOT,'submission/presentation_assets/fonts',f)));
 for(const [name,weight] of [['Regular',400],['Medium',500],['Bold',700]])registerPdfFontFace({family:'Inter',weight,style:'normal',source:await fs.readFile(path.join(ROOT,'submission/presentation_assets/fonts',`Inter-${name}.ttf`))});
 const deck=await PresentationFile.importPptx(await FileBlob.load(path.join(ROOT,'submission/HUMAIN_Lifecycle_Presentation.pptx')));
 const pdf=await deck.export({format:'pdf'});
 const bytes=new Uint8Array(await pdf.arrayBuffer());
 await fs.writeFile(path.join(ROOT,'submission/HUMAIN_Lifecycle_Presentation.pdf'),bytes);
 console.log('Vector PDF exported: '+bytes.length+' bytes');
}catch(e){console.error(e.message);process.exitCode=1;}
