import { WORKFLOW_TRANSITIONS, isValidTransition, getAllowedTransitions, getFlowSteps } from './index';

describe('Workflow Transitions', () => {
  describe('WORKFLOW_TRANSITIONS map', () => {
    it('should have all terminal states with no outgoing transitions', () => {
      expect(WORKFLOW_TRANSITIONS['COMPLETED']).toEqual([]);
      expect(WORKFLOW_TRANSITIONS['REJECTED']).toEqual([]);
      expect(WORKFLOW_TRANSITIONS['CANCELLED']).toEqual([]);
    });

    it('should allow DRAFT to SUBMITTED or CANCELLED', () => {
      expect(WORKFLOW_TRANSITIONS['DRAFT']).toContain('SUBMITTED');
      expect(WORKFLOW_TRANSITIONS['DRAFT']).toContain('CANCELLED');
    });

    it('should allow APPROVED to any publish type', () => {
      expect(WORKFLOW_TRANSITIONS['APPROVED']).toContain('RFI_PUBLISHED');
      expect(WORKFLOW_TRANSITIONS['APPROVED']).toContain('RFP_PUBLISHED');
      expect(WORKFLOW_TRANSITIONS['APPROVED']).toContain('RFQ_OPEN');
    });

    it('should not allow terminal transitions to go anywhere', () => {
      expect(isValidTransition('COMPLETED', 'DRAFT')).toBe(false);
      expect(isValidTransition('REJECTED', 'DRAFT')).toBe(false);
      expect(isValidTransition('CANCELLED', 'DRAFT')).toBe(false);
    });

    it('should reject transitions that skip phases', () => {
      expect(isValidTransition('DRAFT', 'COMPLETED')).toBe(false);
      expect(isValidTransition('SUBMITTED', 'RFP_PUBLISHED')).toBe(false);
      expect(isValidTransition('EVALUATION', 'COMPLETED')).toBe(false);
    });
  });

  describe('isValidTransition', () => {
    it('should return true for valid transitions', () => {
      expect(isValidTransition('DRAFT', 'SUBMITTED')).toBe(true);
      expect(isValidTransition('SUBMITTED', 'UNDER_PROCUREMENT_REVIEW')).toBe(true);
      expect(isValidTransition('UNDER_PROCUREMENT_REVIEW', 'APPROVED')).toBe(true);
      expect(isValidTransition('APPROVED', 'RFP_PUBLISHED')).toBe(true);
      expect(isValidTransition('AWARD_ANNOUNCED', 'COMPLETED')).toBe(true);
    });

    it('should return false for invalid transitions', () => {
      expect(isValidTransition('DRAFT', 'APPROVED')).toBe(false);
      expect(isValidTransition('SUBMITTED', 'COMPLETED')).toBe(false);
      expect(isValidTransition('REJECTED', 'DRAFT')).toBe(false);
      expect(isValidTransition('', 'DRAFT')).toBe(false);
    });
  });

  describe('getAllowedTransitions', () => {
    it('should return the correct array for a known status', () => {
      expect(getAllowedTransitions('DRAFT')).toEqual(
        expect.arrayContaining(['SUBMITTED', 'CANCELLED']),
      );
    });

    it('should return empty array for unknown status', () => {
      expect(getAllowedTransitions('UNKNOWN')).toEqual([]);
    });
  });

  describe('getFlowSteps', () => {
    it('should return RFI flow steps', () => {
      const steps = getFlowSteps('RFI');
      expect(steps).toContain('RFI_PUBLISHED');
      expect(steps).toContain('RFI_COLLECTING');
      expect(steps).toContain('RFI_CLOSED');
      expect(steps).toContain('RFP_DRAFTING');
    });

    it('should return RFP flow without RFI steps', () => {
      const steps = getFlowSteps('RFP');
      expect(steps).not.toContain('RFI_PUBLISHED');
      expect(steps).not.toContain('RFI_COLLECTING');
      expect(steps).toContain('RFP_PUBLISHED');
    });

    it('should return RFQ flow for default', () => {
      const steps = getFlowSteps('RFQ');
      expect(steps).not.toContain('RFI_PUBLISHED');
      expect(steps).toContain('RFQ_OPEN');
    });

    it('should all end with COMPLETED', () => {
      expect(getFlowSteps('RFI').slice(-1)).toEqual(['COMPLETED']);
      expect(getFlowSteps('RFP').slice(-1)).toEqual(['COMPLETED']);
      expect(getFlowSteps('RFQ').slice(-1)).toEqual(['COMPLETED']);
    });
  });
});
