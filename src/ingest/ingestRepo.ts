import { listSourceFiles } from '../util/listSourceFiles.js';
import { evidenceBundleSchema, type EvidenceBundle } from './evidenceSchema.js';
import { readPackageJson } from './packageJson.js';
import { extractBuildConfig } from './buildConfig.js';
import { scanExistingTests } from './existingTests.js';
import { extractCommentSignals } from './commentSignals.js';
import { associateSignalsWithRoutes } from './associateSignalsWithRoutes.js';
import { expressRouterDetector } from './routeDetectors/expressRouter.js';
import { nextAppRouterDetector } from './routeDetectors/nextAppRouter.js';
import type { RouteDetector } from './routeDetectors/detector.js';
import { clientSideSecretGateDetector } from './smellDetectors/clientSideSecretGate.js';
import type { SmellDetector } from './smellDetectors/detector.js';

const ROUTE_DETECTORS: RouteDetector[] = [expressRouterDetector, nextAppRouterDetector];
const SMELL_DETECTORS: SmellDetector[] = [clientSideSecretGateDetector];

export async function ingestRepo(repoPath: string): Promise<EvidenceBundle> {
  const packageJson = readPackageJson(repoPath);
  const filePaths = listSourceFiles(repoPath);
  const buildConfig = extractBuildConfig(repoPath);
  const routes = ROUTE_DETECTORS.filter((detector) => detector.applies(packageJson)).flatMap((detector) =>
    detector.detect(repoPath, filePaths)
  );
  const existingTests = scanExistingTests(repoPath, filePaths, packageJson);
  const commentSignals = associateSignalsWithRoutes(routes, extractCommentSignals(repoPath, filePaths));
  const smellSignals = SMELL_DETECTORS.flatMap((detector) => detector.detect(repoPath, filePaths));
  const signals = [...commentSignals, ...smellSignals];

  return evidenceBundleSchema.parse({
    repoPath,
    generatedAt: new Date().toISOString(),
    packageJson,
    buildConfig,
    routes,
    existingTests,
    signals
  });
}
