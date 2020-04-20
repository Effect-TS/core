module.exports = {
  rootDir: "./",
  clearMocks: true,
  collectCoverage: true,
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
  modulePathIgnorePatterns: ["dtslint"],
  verbose: true
};
