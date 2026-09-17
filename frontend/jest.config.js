module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: [
    '@testing-library/react-native/extend-expect',
    '<rootDir>/jest.setup.js',
  ],
};
