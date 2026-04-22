import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { UpstreamConfigPage } from "../../../src/ui/app.js";

afterEach(() => {
  cleanup();
});

describe("config export", () => {
  it("exports the current config as JSON preview", async () => {
    const user = userEvent.setup();

    render(<UpstreamConfigPage />);

    await user.click(screen.getByRole("button", { name: "Export JSON" }));

    const output = screen.getByLabelText("Export JSON Preview");

    expect(output).toHaveTextContent('"version": 1');
    expect(output).toHaveTextContent('"channels"');
    expect(output).toHaveTextContent('"models"');
    expect(output).toHaveTextContent('"priorities"');
    expect(output).toHaveTextContent('"channel-openai"');
  });
});
