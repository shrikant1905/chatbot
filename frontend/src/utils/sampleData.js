// Demo conversations and sample prompt data for frontend preview
// NOTE: All content is client-side mock demonstration data to showcase the UI design.

export const INITIAL_CONVERSATIONS = [
  {
    id: 'demo-conv-1',
    title: 'Quantum Computing & Code Explainer',
    group: 'Today',
    updatedAt: '10:45 AM',
    messages: [
      {
        id: 'msg-1',
        role: 'user',
        timestamp: '10:45 AM',
        content: 'Can you explain how quantum superposition works, give a code snippet in Python using Qiskit, and summarize the key benefits in a clean table?'
      },
      {
        id: 'msg-2',
        role: 'assistant',
        timestamp: '10:46 AM',
        content: `# Understanding Quantum Superposition

In classical computing, a bit is strictly binary: it holds either **0** or **1**. In contrast, a quantum bit (or *qubit*) can exist in a linear combination of both states simultaneously:

$$|\\psi\\rangle = \\alpha|0\\rangle + \\beta|1\\rangle$$

> "If you think you understand quantum mechanics, you don't understand quantum mechanics." — *Richard Feynman*

### Key Quantum Principles:
* **Superposition**: Processing multiple potential computational paths concurrently.
* **Entanglement**: Instantaneous correlation between linked qubits regardless of physical distance.
* **Interference**: Amplifying probability amplitudes for correct answers while cancelling errors.

---

### Python Example with Qiskit

Here is how you initialize a single qubit into a superposition state using a **Hadamard gate**:

\`\`\`python
from qiskit import QuantumCircuit, execute, Aer

# Initialize quantum circuit with 1 qubit and 1 classical bit
circuit = QuantumCircuit(1, 1)

# Apply Hadamard gate to place qubit into superposition
circuit.h(0)

# Measure the qubit
circuit.measure(0, 0)

# Simulate circuit execution on local quantum simulator
simulator = Aer.get_backend('qasm_simulator')
job = execute(circuit, simulator, shots=1000)
result = job.result()
counts = result.get_counts(circuit)

print("Measurement distribution:", counts)
\`\`\`

---

### Classical vs Quantum Comparison

| Feature | Classical Computing | Quantum Computing |
| :--- | :--- | :--- |
| **Fundamental Unit** | Bit ($0$ or $1$) | Qubit ($|0\\rangle, |1\\rangle$ superposition) |
| **Scaling Factor** | Linear ($N$ bits) | Exponential ($2^N$ states) |
| **Primary Advantage** | Deterministic processing & logic | Complex combinatorial optimization & chemistry |
| **Operating Temp** | Ambient room temperature | Near absolute zero (sub-Kelvin cryogenics) |

Feel free to ask if you would like to explore entanglement circuits, Grover search algorithms, or error mitigation strategies next!`
      }
    ]
  },
  {
    id: 'demo-conv-2',
    title: 'SaaS Marketing Hook Strategy',
    group: 'Yesterday',
    updatedAt: 'Yesterday',
    messages: [
      {
        id: 'msg-3',
        role: 'user',
        timestamp: 'Yesterday',
        content: 'Give me 3 compelling value propositions for an AI product.'
      },
      {
        id: 'msg-4',
        role: 'assistant',
        timestamp: 'Yesterday',
        content: `### 3 High-Conversion Value Propositions:

1. **Velocity Without Cognitive Debt**: "Automate repetitive workflows without sacrificing code quality or control."
2. **Context-Aware Precision**: "Unlike generic chatbots, Kiaan understands your entire project ecosystem from day one."
3. **Enterprise Privacy by Default**: "Zero retention, client-side encryption, and dedicated sandbox isolation."`
      }
    ]
  },
  {
    id: 'demo-conv-3',
    title: 'React Custom Hooks Architecture',
    group: 'Previous 7 Days',
    updatedAt: '3 days ago',
    messages: [
      {
        id: 'msg-5',
        role: 'user',
        timestamp: '3 days ago',
        content: 'What is the best way to handle debouncing in a React hook?'
      },
      {
        id: 'msg-6',
        role: 'assistant',
        timestamp: '3 days ago',
        content: `Here is a clean implementation of \`useDebounce\` with cleanup:

\`\`\`javascript
import { useState, useEffect } from 'react';

export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}
\`\`\``
      }
    ]
  }
];

export const SUGGESTIONS = [
  {
    id: 'sug-1',
    icon: 'Feather',
    title: 'Write something amazing',
    description: 'Draft a high-converting landing page copy for a new SaaS product',
    prompt: 'Draft high-converting landing page copy for a modern AI developer workspace called Kiaan, highlighting its speed, aesthetics, and privacy.'
  },
  {
    id: 'sug-2',
    icon: 'Atom',
    title: 'Explain a complex topic',
    description: 'Explain quantum computing and superposition using simple metaphors',
    prompt: 'Explain how quantum superposition works and how quantum computers differ from classical computers, using simple intuitive metaphors.'
  },
  {
    id: 'sug-3',
    icon: 'Code',
    title: 'Help me with code',
    description: 'Review a React performance optimization strategy with custom hooks',
    prompt: 'Explain best practices for optimizing rendering performance in large React applications, with an example custom hook.'
  },
  {
    id: 'sug-4',
    icon: 'Sparkles',
    title: 'Brainstorm new ideas',
    description: '5 creative feature concepts for an intelligent developer workspace',
    prompt: 'Brainstorm 5 innovative, developer-first features that would set a modern AI coding assistant apart from existing tools.'
  }
];

export const AVAILABLE_MODELS = [
  { id: 'kiaan-ultra', name: 'Kiaan Ultra 4.5', description: 'Most capable model for deep reasoning, coding, and analysis', tag: 'Fast & Smart' },
  { id: 'kiaan-pro', name: 'Kiaan Pro 3.5', description: 'Optimized for high-speed conversational workflows', tag: 'Balanced' },
  { id: 'kiaan-code', name: 'Kiaan Code Alpha', description: 'Specialized checkpoint tuned for multi-file system design', tag: 'Code' }
];

