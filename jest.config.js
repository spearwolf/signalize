/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * - https://jestjs.io/docs/en/configuration.html
 * - https://kulshekhar.github.io/ts-jest/
 */

/** @type {import('jest').Config} */
export default {
  clearMocks: true,
  notify: false,

  setupFilesAfterEnv: ['jest-expect-message'],

  roots: ['./src'],
  testMatch: ['**/?(*.)+(spec|test).[tj]s'],

  preset: 'ts-jest',
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js'],
  moduleNameMapper: {
    '(.+)\\.js$': '$1',
  },
  extensionsToTreatAsEsm: ['.ts'],
};
