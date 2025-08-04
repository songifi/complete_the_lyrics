import { StateMachine } from 'javascript-state-machine';

export const InvestigationFSM = new StateMachine({
  init: 'pending',
  transitions: [
    { name: 'startInvestigation', from: 'pending', to: 'investigating' },
    { name: 'resolve', from: 'investigating', to: 'resolved' },
    { name: 'appeal', from: 'resolved', to: 'appealed' },
    { name: 'reopen', from: 'appealed', to: 'investigating' },
  ],
  methods: {
    onStartInvestigation() { /* log or notify */ },
    onResolve() { /* log or notify */ },
    onAppeal() { /* log or notify */ },
    onReopen() { /* log or notify */ },
  }
});
