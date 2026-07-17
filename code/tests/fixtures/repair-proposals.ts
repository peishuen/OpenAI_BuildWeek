export const validRepairProposal = {
  replacementSelector: "#sign-in-button-v2",
  diagnosis: "The sign-in button ID changed.",
  evidence: "The controlled fixture renders the v2 ID.",
};

export const invalidSelectorProposal = {
  ...validRepairProposal,
  replacementSelector: "[data-testid=",
};
