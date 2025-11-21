"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"; // Assuming these exist or standard shadcn
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { searchProjectsAction } from "../actions";

// Simple debounce hook if not available
function useDebounceValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

interface EstimatePickerProps {
  onSelect: (projectId: string | null) => void;
  selectedProjectId?: string | null;
}

export function EstimatePicker({ onSelect, selectedProjectId }: EstimatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const debouncedQuery = useDebounceValue(query, 300);
  const [projects, setProjects] = React.useState<{ id: string; name: string; clientName: string | null }[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedProjectName, setSelectedProjectName] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchProjects() {
      setLoading(true);
      const results = await searchProjectsAction(debouncedQuery);
      setProjects(results);
      setLoading(false);
    }
    fetchProjects();
  }, [debouncedQuery]);

  React.useEffect(() => {
    // If we have a selectedProjectId but no name, try to find it in the list or fetch it (simplified: just rely on list for now)
    if (selectedProjectId && !selectedProjectName) {
        const found = projects.find(p => p.id === selectedProjectId);
        if (found) setSelectedProjectName(found.name);
    }
  }, [selectedProjectId, projects, selectedProjectName]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedProjectName ? selectedProjectName : "Select project..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Search projects..." 
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {loading && <div className="py-6 text-center text-sm text-muted-foreground">Loading...</div>}
            {!loading && projects.length === 0 && <CommandEmpty>No projects found.</CommandEmpty>}
            <CommandGroup>
              {projects.map((project) => (
                <CommandItem
                  key={project.id}
                  value={project.id}
                  onSelect={(currentValue) => {
                    onSelect(currentValue === selectedProjectId ? null : currentValue);
                    setSelectedProjectName(project.name);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedProjectId === project.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{project.name}</span>
                    {project.clientName && <span className="text-xs text-muted-foreground">{project.clientName}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

