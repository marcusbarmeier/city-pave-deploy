
/**
 * calc-core.js
 * Pure logic for evaluating custom calculator formulas.
 */

export function evaluateFormula(formula, inputs) {
    try {
        // Create function with input keys as args
        const paramNames = Object.keys(inputs);
        const paramValues = Object.values(inputs);

        // Safely evaluate
        // NOTE: In production, we should use a safer parser like math.js
        // For MVP, we use new Function, assuming config source is trusted (internal admin).

        const func = new Function(...paramNames, `try { return ${formula}; } catch(e) { return 0; }`);
        return func(...paramValues);

    } catch (e) {
        console.error(`Error evaluating formula: ${formula}`, e);
        return 0;
    }
}

export function runCalculations(config, currentInputs) {
    const results = {};
    const scope = { ...currentInputs };

    config.calculations.forEach(calc => {
        const val = evaluateFormula(calc.formula, scope);
        results[calc.id] = val;
        // make result available for subsequent formulas
        scope[calc.id] = val;
    });

    return results;
}
