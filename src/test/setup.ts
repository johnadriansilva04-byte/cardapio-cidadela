import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Sem isto o DOM de cada teste fica no body e as queries encontram
// elementos de testes anteriores.
afterEach(cleanup);
