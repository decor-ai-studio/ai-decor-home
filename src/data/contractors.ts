import type { Contractor, RatingMatrix } from "@/engines/contractors";

// Sample execution contractors around Greater Cairo. Coordinates are approximate
// city-district centroids, used only to demonstrate proximity scoring.
export const SAMPLE_CONTRACTORS: Contractor[] = [
  {
    id: "ct_nakhba",
    name: "النخبة لواجهات المحلات",
    city: "مدينة نصر",
    location: { lat: 30.0566, lng: 31.3301 },
    specialties: ["cladding", "signage", "full_facade"],
    capability: 0.82,
    metrics: { scheduleAdherence: 0.93, costAccuracy: 0.88, reviewScore: 4.7, completedProjects: 64 },
  },
  {
    id: "ct_almasa",
    name: "الماسة للكلادنج والإضاءة",
    city: "المعادي",
    location: { lat: 29.9603, lng: 31.2596 },
    specialties: ["cladding", "lighting"],
    capability: 0.66,
    metrics: { scheduleAdherence: 0.86, costAccuracy: 0.9, reviewScore: 4.4, completedProjects: 41 },
  },
  {
    id: "ct_horizon",
    name: "هورايزون للواجهات الزجاجية",
    city: "الشيخ زايد",
    location: { lat: 30.0778, lng: 30.9754 },
    specialties: ["glass", "full_facade"],
    capability: 0.9,
    metrics: { scheduleAdherence: 0.8, costAccuracy: 0.83, reviewScore: 4.6, completedProjects: 52 },
  },
  {
    id: "ct_noor",
    name: "نور للحروف المضيئة",
    city: "مصر الجديدة",
    location: { lat: 30.0875, lng: 31.3286 },
    specialties: ["signage", "lighting"],
    capability: 0.5,
    metrics: { scheduleAdherence: 0.95, costAccuracy: 0.79, reviewScore: 4.2, completedProjects: 28 },
  },
  {
    id: "ct_binaa",
    name: "بناء المتكاملة للمقاولات",
    city: "6 أكتوبر",
    location: { lat: 29.9668, lng: 30.9476 },
    specialties: ["full_facade", "cladding", "glass"],
    capability: 0.95,
    metrics: { scheduleAdherence: 0.78, costAccuracy: 0.86, reviewScore: 4.5, completedProjects: 88 },
  },
];

// Sparse client × contractor ratings (0..5) used to demo collaborative filtering.
// "client_demo" is the requesting client; note they have NOT rated every contractor,
// so the engine predicts the missing ones from similar clients.
export const SAMPLE_RATINGS: RatingMatrix = {
  client_demo: { ct_nakhba: 5, ct_noor: 4 },
  client_a: { ct_nakhba: 5, ct_almasa: 4, ct_horizon: 3, ct_noor: 4 },
  client_b: { ct_nakhba: 4, ct_horizon: 5, ct_binaa: 5 },
  client_c: { ct_almasa: 5, ct_noor: 5, ct_binaa: 3 },
  client_d: { ct_nakhba: 5, ct_binaa: 4, ct_horizon: 4 },
};
