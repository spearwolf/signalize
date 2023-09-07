/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

export function makeVersionWithBuild(build) {
  const today = new Date();
  let month = today.getUTCMonth() + 1;
  if (month < 10) {
    month = `0${month}`;
  }
  let date = today.getUTCDate();
  if (date < 10) {
    date = `0${date}`;
  }
  return (version) =>
    `${version}+${build}.${today.getUTCFullYear()}${month}${date}`;
}
