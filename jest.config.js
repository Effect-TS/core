// eslint-disable-next-line
module.exports = {
  rootDir: "./",
  clearMocks: true,
  collectCoverage: false,
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "packages/**/src/**/*.ts",
    "packages_be/**/src/**/*.ts",
    "packages_fe/**/src/**/*.ts",
    "packages_http/**/src/**/*.ts",
    "packages_inc/**/src/**/*.ts",
    "packages_sys/**/src/**/*.ts"
  ],
  setupFiles: ["./jest-setup.ts"],
  modulePathIgnorePatterns: ["dtslint", "build"],
  verbose: false,
  moduleNameMapper: {
    "@matechs/core/(.*)$": "<rootDir>/packages/core/build/$1",
    "@matechs/core$": "<rootDir>/packages/core/build",
    "@matechs/contrib/(.*)$": "<rootDir>/packages/contrib/build",
    "@matechs/contrib$": "<rootDir>/packages/contrib/build/$1",
    "@matechs/test/(.*)$": "<rootDir>/packages/test/build/$1",
    "@matechs/test$": "<rootDir>/packages/test/build",
    "@matechs/test-jest/(.*)$": "<rootDir>/packages/test-jest/build/$1",
    "@matechs/test-jest$": "<rootDir>/packages/test-jest/build",
    "@matechs/aio/(.*)$": "<rootDir>/packages/aio/build/$1",
    "@matechs/aio$": "<rootDir>/packages/aio/build",
    "@matechs/graceful/(.*)$": "<rootDir>/packages_be/graceful/build/$1",
    "@matechs/graceful$": "<rootDir>/packages_be/graceful/build",
    "@matechs/orm/(.*)$": "<rootDir>/packages_be/orm/build/$1",
    "@matechs/orm$": "<rootDir>/packages_be/orm/build",
    "@matechs/tracing/(.*)$": "<rootDir>/packages_be/tracing/build/$1",
    "@matechs/tracing$": "<rootDir>/packages_be/tracing/build",
    "@matechs/uuid/(.*)$": "<rootDir>/packages_be/uuid/build/$1",
    "@matechs/uuid$": "<rootDir>/packages_be/uuid/build",
    "@matechs/zoo/(.*)$": "<rootDir>/packages_be/zoo/build/$1",
    "@matechs/zoo$": "<rootDir>/packages_be/zoo/build"
  }
}
