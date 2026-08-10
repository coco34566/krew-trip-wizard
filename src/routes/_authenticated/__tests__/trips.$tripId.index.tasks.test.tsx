import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock des server functions
vi.mock("@/lib/trips.functions", async () => {
  return {
    updateTaskStatus: vi.fn().mockResolvedValue({ ok: true }),
    reassignTask: vi.fn().mockResolvedValue({ ok: true }),
    generateTasksForTrip: vi.fn().mockResolvedValue({ ok: true, count: 0 }),
  };
});

// Reproduit le pattern exact de la mutation, pour un test rapide et isolé
// sans dépendre du montage de toute la route.
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { updateTaskStatus } from "@/lib/trips.functions";

function TaskStatusButton() {
  const updateTaskStatusFn = useServerFn(updateTaskStatus);
  const mutation = useMutation({
    mutationFn: (status: string) => updateTaskStatusFn({ data: { taskId: "t1", status } }),
  });
  return <button onClick={() => mutation.mutate("done")}>Marquer fait</button>;
}

describe("mise à jour du statut d'une tâche", () => {
  it("ne lève pas d'erreur 'Invalid hook call' au clic", async () => {
    const qc = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    render(
      <QueryClientProvider client={qc}>
        <TaskStatusButton />
      </QueryClientProvider>,
    );
    await userEvent.click(screen.getByText("Marquer fait"));
    expect(updateTaskStatus).toHaveBeenCalled();
  });
});
