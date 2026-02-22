const toLowerMessage = (error) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase();
};

export const FailureCategory = Object.freeze({
  TRANSIENT: 'transient',
  DETERMINISTIC: 'deterministic',
  DEPENDENCY_FAILURE: 'dependency failure',
  CONTRACT_VIOLATION: 'contract violation'
});

export class FailureClassifier {
  classify(failure) {
    const message = toLowerMessage(failure.error);

    if (message.includes('provider not found') || message.includes('provider unavailable') || message.includes('inactive')) {
      return FailureCategory.DEPENDENCY_FAILURE;
    }

    if (message.includes('must') || message.includes('invalid') || message.includes('cannot') || message.includes('undeclared')) {
      return FailureCategory.CONTRACT_VIOLATION;
    }

    if (failure.source === 'lifecycle' && (message.includes('timeout') || message.includes('temporary') || message.includes('network'))) {
      return FailureCategory.TRANSIENT;
    }

    return FailureCategory.DETERMINISTIC;
  }
}
