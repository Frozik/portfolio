# Pendulum

A genetic algorithm evolves small neural networks to swing up and balance an inverted pendulum on a cart; own inference, closed-form physics, no engine.

Live: [https://frozik.github.io/portfolio/pendulum](https://frozik.github.io/portfolio/pendulum) · Part of the [portfolio](../../../../../README.md) monorepo; code lives in `apps/portfolio/src/features/pendulum/`.

Genetic algorithm evolves neural networks to balance an inverted pendulum.
Inference is a dense `tanh` forward pass written here
(`domain/neural-network/`) rather than a framework call. TensorFlow.js, which
this feature used until September 2026, was dropped for two reasons. It is
dormant: its last stable release is 4.22.0 from October 2024, and the 4.23
release candidate has sat unpromoted since January 2025. And it was slow here
— one inference costs 0.23 µs now, against the 16 µs tf.js spent and the 28 µs
ONNX Runtime Web spends, because at this size a runtime's per-call overhead is
the whole cost: the network itself is under a hundred multiplications.
Measured on the same page, a framework only starts winning past roughly fifty
thousand of them, some five hundred times this network. Should the topology
ever grow that far, only the forward pass has to change — and to ONNX Runtime,
since the tf.js CPU backend never won at any size measured. Dropping tf.js
also took 947 KB off the feature's chunk, which now weighs 46 KB.

The physics is the
closed-form Lagrangian model of an N-link chain pendulum on a cart with a
prescribed rail velocity (mass-matrix form, exact impulse when the cart's
velocity changes, quadratic air drag, pointer push), integrated with RK4 at a
substep capped to 4 ms — no physics engine, deterministic and effectively
independent of the frame rate.

**Fitness Playground** — simulation area for neural networks. Each robot is
a `5 → 16 (tanh) → 1 (tanh)` network that sees the rod's angle from the
upright as a sine/cosine pair, its angular velocity, and the cart's rail
position and velocity, and commands the cart's acceleration. Fitness is a
dense per-millisecond reward: the squared height of the bob, a bonus for
holding it still inside a 15° cone around the upright, and mild penalties for
drifting off-centre and for jerky accelerations. Every robot runs two
episodes per generation, one from the hanging rest and one from a slightly
tilted upright, and is scored on their sum: the upright start pays for the
balancing skill directly, so the swing-up only has to end in a catch the
robot already knows. The best fifth survives each generation (seasoned robots
restart from random rail positions), and the rest is bred from
tournament-picked parents by gaussian mutation and crossover; a robot that
balances typically appears within the first ten generations.
Simulation speed adapts automatically to CPU performance without freezing
the UI.

**Generations** — load saved generations or create new ones. Displays a table
with generation numbers and all robots from that generation. Select any robot
to test it.

**Test Playground** — test individual robots by applying external forces.
Click on the area to introduce instability — closer to the weight means
stronger force, longer press means greater effect. Deselect the robot to try
manual control (arrow keys for movement, Shift for boost).

**Neural Network** — visualizes the network structure: weights, biases, layers,
and neuron counts. Hover over a neuron to inspect its weights and biases.
