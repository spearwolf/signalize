// The build tag carries no date on purpose. The banner has to be a pure
// function of package.json — otherwise two builds of the same commit ship
// different bytes and a consumer cannot verify the published artifact
// against their own rebuild (SEC-001). `scripts/check-banner.mjs` holds it.
export function makeVersionWithBuild(build) {
  return (version) => `${version}+${build}`;
}
