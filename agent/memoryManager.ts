import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), "agent", "data");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJsonFile<T>(filename: string, defaultValue: T): T {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), "utf-8");
    return defaultValue;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

function writeJsonFile<T>(filename: string, data: T): void {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export interface MemoryFact {
  key: string;
  value: string;
  category?: string;
  updatedAt: string;
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

export interface TaskItem {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

export class MemoryManager {
  private memoryFile = "memory.json";
  private notesFile = "notes.json";
  private tasksFile = "tasks.json";

  public rememberFact(key: string, value: string, category = "general"): string {
    const facts = readJsonFile<Record<string, MemoryFact>>(this.memoryFile, {});
    const cleanKey = key.trim().toLowerCase().replace(/\s+/g, "_");
    facts[cleanKey] = {
      key: cleanKey,
      value: value.trim(),
      category,
      updatedAt: new Date().toISOString(),
    };
    writeJsonFile(this.memoryFile, facts);
    return `Saved to memory: "${key}" is set to "${value}".`;
  }

  public recallFact(query: string): string | null {
    const facts = readJsonFile<Record<string, MemoryFact>>(this.memoryFile, {});
    const cleanQuery = query.trim().toLowerCase();

    // Exact key match
    const exactKey = cleanQuery.replace(/\s+/g, "_");
    if (facts[exactKey]) {
      return facts[exactKey].value;
    }

    // Partial search
    for (const [k, item] of Object.entries(facts)) {
      if (cleanQuery.includes(k.replace(/_/g, " ")) || k.includes(cleanQuery)) {
        return item.value;
      }
      if (item.value.toLowerCase().includes(cleanQuery)) {
        return item.value;
      }
    }
    return null;
  }

  public getAllFacts(): Record<string, MemoryFact> {
    return readJsonFile<Record<string, MemoryFact>>(this.memoryFile, {});
  }

  public createNote(title: string, content: string): NoteItem {
    const notes = readJsonFile<NoteItem[]>(this.notesFile, []);
    const newNote: NoteItem = {
      id: `note_${Date.now()}`,
      title: title.trim(),
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };
    notes.unshift(newNote);
    writeJsonFile(this.notesFile, notes);
    return newNote;
  }

  public searchNotes(query: string): NoteItem[] {
    const notes = readJsonFile<NoteItem[]>(this.notesFile, []);
    const q = query.toLowerCase();
    return notes.filter(
      (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    );
  }

  public createTask(title: string): TaskItem {
    const tasks = readJsonFile<TaskItem[]>(this.tasksFile, []);
    const newTask: TaskItem = {
      id: `task_${Date.now()}`,
      title: title.trim(),
      completed: false,
      createdAt: new Date().toISOString(),
    };
    tasks.unshift(newTask);
    writeJsonFile(this.tasksFile, tasks);
    return newTask;
  }

  public getTasks(): TaskItem[] {
    return readJsonFile<TaskItem[]>(this.tasksFile, []);
  }

  public completeTask(taskIdOrTitle: string): boolean {
    const tasks = readJsonFile<TaskItem[]>(this.tasksFile, []);
    const target = tasks.find(
      (t) => t.id === taskIdOrTitle || t.title.toLowerCase().includes(taskIdOrTitle.toLowerCase())
    );
    if (target) {
      target.completed = true;
      writeJsonFile(this.tasksFile, tasks);
      return true;
    }
    return false;
  }
}

export const memoryManager = new MemoryManager();
