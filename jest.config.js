// eslint-disable-next-line
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "./",
  clearMocks: true,
  collectCoverage: false,
  coverageDirectory: "coverage",
  collectCoverageFrom: ["packages/**/src/**/*.ts"],
  setupFiles: ["./scripts/jest-setup.ts"],
  modulePathIgnorePatterns: ["<rootDir>/packages/.*/build", "<rootDir>/_tmp"],
  verbose: false,
  moduleNameMapper: {
    "@effect-ts/morphic/(.*)$": "<rootDir>/packages/morphic/build/$1",
    "@effect-ts/morphic$": "<rootDir>/packages/morphic/build",
    "@effect-ts/monocle/(.*)$": "<rootDir>/packages/monocle/build/$1",
    "@effect-ts/monocle$": "<rootDir>/packages/monocle/build",
    "@effect-ts/system/(.*)$": "<rootDir>/packages/system/build/$1",
    "@effect-ts/system$": "<rootDir>/packages/system/build",
    "@effect-ts/core/(.*)$": "<rootDir>/packages/core/build/$1",
    "@effect-ts/core$": "<rootDir>/packages/core/build"
  }
}
