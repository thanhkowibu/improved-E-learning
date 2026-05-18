"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

interface Course {
  id: number;
  title: string;
  description: string;
}

export default function Home() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCourses() {
      try {
        const response = await api.get("/courses");
        setCourses(response.data.data);
      } catch (error) {
        console.error("Failed to fetch courses:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchCourses();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading courses...</p>
      </div>
    );
  }

  return (
    <main className="p-8 max-w-4xl mx-auto mt-10 bg-white rounded-xl shadow-sm border border-slate-200">
      <h1 className="text-3xl font-bold mb-6 text-slate-800">E-Learning Courses</h1>
      
      {courses.length === 0 ? (
        <div className="p-6 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
          <p className="font-medium text-center">No courses are currently available. DB connection successful!</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {courses.map((course) => (
            <li key={course.id} className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
              <h2 className="text-xl font-semibold text-slate-700">{course.title}</h2>
              {course.description && (
                <p className="text-slate-500 mt-2">{course.description}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
