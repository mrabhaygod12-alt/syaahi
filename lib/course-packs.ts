/** Course-pack starters are planning aids, never official university syllabi. */
export interface CoursePack {
  slug: string;
  institution: string;
  programme: string;
  term: string;
  title: string;
  description: string;
  topics: string[];
}

export const COURSE_PACKS: CoursePack[] = [
  {
    slug: "lpu-cse-sem3-data-structures", institution: "Lovely Professional University", programme: "Computer Science & Engineering", term: "Semester 3", title: "Data Structures foundations",
    description: "A starter revision outline for common data-structures concepts. Compare every unit with the current LPU course outline.",
    topics: ["Arrays, complexity and asymptotic analysis", "Linked lists and pointer operations", "Stacks, queues and expression evaluation", "Trees, binary search trees and traversals", "Heaps, hashing and priority queues", "Graphs: representation, traversal and shortest paths"],
  },
  {
    slug: "ktu-btech-data-structures", institution: "APJ Abdul Kalam Technological University", programme: "B.Tech", term: "Core computing course", title: "Data structures and algorithms revision",
    description: "A general B.Tech revision path for data structures. It is not an official KTU syllabus or a guarantee of examination coverage.",
    topics: ["Algorithm analysis and recursion", "Linear data structures", "Trees and balanced search trees", "Hashing and heaps", "Graph algorithms", "Sorting and searching"],
  },
  {
    slug: "aktu-btech-programming-foundations", institution: "Dr. A.P.J. Abdul Kalam Technical University", programme: "B.Tech", term: "Foundation course", title: "Programming foundations",
    description: "A reusable programming starter outline. Confirm the latest AKTU unit names, language and assessment pattern with your institution.",
    topics: ["Variables, control flow and functions", "Arrays, strings and memory basics", "Object-oriented programming principles", "Data structures and algorithmic thinking", "Files, exceptions and debugging", "Revision problems and complexity"],
  },
];

export function coursePack(slug: string) {
  return COURSE_PACKS.find((pack) => pack.slug === slug) || null;
}
