import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const SKILL=process.env.PRESENTATIONS_SKILL_DIR || 'C:/Users/mesha/.codex/plugins/cache/openai-primary-runtime/presentations/26.1029.11837/skills/presentations';
const MOD=process.env.RUNTIME_NODE_MODULES || 'C:/Users/mesha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
process.env.RUNTIME_NODE_MODULES=MOD;
const {finalizePresentation}=await import(pathToFileURL(path.join(SKILL,'container_tools/artifact_tool_utils.mjs')).href);
await fs.mkdir(path.join(ROOT,'tmp/presentation-final'),{recursive:true});
const validatedPath=path.join(ROOT,'tmp/presentation-final',`validated-${Date.now()}.pptx`);
// Some managed Windows workspaces disallow hard links. Preserve exclusive
// destination creation with a byte-for-byte copy of the validated file.
const originalLink=fs.link;
fs.link=async(source,destination)=>{
 try{return await originalLink(source,destination);}catch(error){
  if(error.code!=='EPERM')throw error;
  return fs.copyFile(source,destination,constants.COPYFILE_EXCL);
 }
};
const result=await finalizePresentation({
 workspaceDir:ROOT,
 candidatePath:path.join(ROOT,'tmp/presentation-build/candidate.pptx'),
 finalPath:validatedPath,
 pythonExecutable:'C:/Users/mesha/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',
 integrityValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_package_integrity.py'),
 layoutValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_layout_geometry.py'),
 layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit'],
 explicitTotalSlideCount:10,
 requiredNativeTableOwnerSlides:[],requiredNativeChartOwnerSlides:[],
 fontPolicy:{basis:'user_request',families:['Inter']},
 verifyArtifactToolImport:true,
 receiptPath:path.join(ROOT,'tmp/presentation-build',`validation-${Date.now()}.json`),
});
await fs.copyFile(validatedPath,path.join(ROOT,'submission/HUMAIN_Lifecycle_Presentation.pptx'));
console.log(JSON.stringify(result));
