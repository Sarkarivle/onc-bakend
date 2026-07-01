# Test Suite Documentation

This directory contains the automated tests for the AI pipeline. These tests are crucial for ensuring system stability, preventing regressions, and evaluating the semantic understanding of the AI.

## Running Tests

All tests are executed via the `runNeuralTests.js` script. You can run all tests at once or target specific modules by providing a numeric argument.

### Run All Tests

This command will execute all test scenarios found in the `scenarios` directory.

```bash
node test_suite/runNeuralTests.js
```

### Run Specific Test Modules

You can run tests for a specific part of the AI pipeline by using its module number.

- **00: Contract Tests**: `node test_suite/runNeuralTests.js 00`
- **02: Neural Refiner Tests**: `node test_suite/runNeuralTests.js 02`
- **03: Intent Engine Tests**: `node test_suite/runNeuralTests.js 03`
- **04: Agentic Planner Tests**: `node test_suite/runNeuralTests.js 04`

### Debug Mode

To get detailed output for failed tests, including the full `actual` object returned by the AI module, run the command with the `DEBUG_AI_PIPELINE` environment variable.

```bash
DEBUG_AI_PIPELINE=true node test_suite/runNeuralTests.js 03
```