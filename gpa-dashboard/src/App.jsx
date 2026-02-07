import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, School, Table as TableIcon, Award, Loader2, LogIn } from 'lucide-react';

// Full list of terms
const TERMS = ["1U1", "1U2", "NW1", "2U1", "2U2", "NW2", "EX1", "SM1", "3U1", "3U2", "NW3", "4U1", "4U2", "NW4"];

const getUnweightedPoint = (score) => {
  if (score >= 90) return 4.0;
  if (score >= 80) return 3.0;
  if (score >= 70) return 2.0;
  return 0.0;
};

const App = () => {
  // --- STATE ---
  const [studentData, setStudentData] = useState(null); 
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // --- API CALL ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch('http://127.0.0.1:8000/get-grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) throw new Error("Login Failed. Check credentials.");
      
      const data = await response.json();
      setStudentData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- CALCULATIONS ---
  const analytics = useMemo(() => {
    if (!studentData) return null;

    // 1. FILTER: Ignore classes that have no real grades (removes "Filler" classes)
    const gradedClasses = studentData.filter(course => {
      return Object.values(course.grades).some(g => g.score > 0);
    });

    // 2. Calculate Max Potential based ONLY on graded classes
    const totalMaxPoints = gradedClasses.reduce((sum, course) => {
        let w = 6.0;
        // Check weights (including the Tech App exception)
        if (course.class_name.includes("AP ") || course.class_name.includes("Ind Study Tech")) w = 8.0;
        else if (course.class_name.includes("APA")) w = 7.0;
        return sum + w;
    }, 0);
    
    // Divide by the REAL count (7 instead of 8)
    const maxPossible = gradedClasses.length > 0 ? (totalMaxPoints / gradedClasses.length).toFixed(2) : 0;

    // 3. Calculate data for every term using only graded classes
    const fullData = TERMS.map(term => {
      let totalWeighted = 0;
      let totalUnweighted = 0;
      let count = 0;

      gradedClasses.forEach(course => {
        if (course.grades[term]) {
          totalWeighted += course.grades[term].gpa_points;
          totalUnweighted += getUnweightedPoint(course.grades[term].score);
          count++;
        }
      });

      return {
        name: term,
        gpa: count > 0 ? (totalWeighted / count).toFixed(2) : 0,
        unweighted: count > 0 ? (totalUnweighted / count).toFixed(2) : 0,
        maxPotential: maxPossible,
        hasData: count > 0 
      };
    });

    // FILTER: Only show terms on the graph that actually have data
    const chartData = fullData.filter(d => d.hasData);

    const currentStatus = chartData.length > 0 ? chartData[chartData.length - 1] : { gpa: 0, unweighted: 0 };

    return { chartData, maxPossible, currentStatus };
  }, [studentData]);

  // --- RENDER: LOGIN SCREEN ---
  if (!studentData) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans">
        <div className="bg-slate-900 p-8 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-md">
          <div className="flex justify-center mb-6">
            <div className="bg-blue-500/10 p-4 rounded-full">
              <School className="w-10 h-10 text-blue-500" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white text-center mb-2">Skyward Analytics</h1>
          <p className="text-slate-400 text-center mb-8">Enter your credentials to scrape data</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input 
                type="text" 
                placeholder="Student ID" 
                className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <input 
                type="password" 
                placeholder="Password" 
                className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 className="animate-spin" /> Scraping Skyward...</> : <><LogIn size={20} /> Connect Dashboard</>}
            </button>
          </form>
          <p className="text-xs text-slate-500 text-center mt-6">
            Your credentials are sent directly to the backend scraper and are never saved.
          </p>
        </div>
      </div>
    );
  }

  const { chartData, maxPossible, currentStatus } = analytics;

  // --- RENDER: DASHBOARD ---
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-blue-400 flex items-center gap-2">
              <School className="w-8 h-8" /> Welcome, {username}
            </h1>
            <button onClick={() => setStudentData(null)} className="text-sm text-slate-500 hover:text-white">Log Out</button>
        </div>

        {/* METRICS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between shadow-lg">
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold">Weighted GPA</p>
              <p className="text-3xl font-bold text-white mt-1">{currentStatus.gpa}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <TrendingUp className="text-blue-400 w-5 h-5" />
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between shadow-lg">
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold">Unweighted (4.0)</p>
              <p className="text-3xl font-bold text-emerald-400 mt-1">{currentStatus.unweighted}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Award className="text-emerald-400 w-5 h-5" />
            </div>
          </div>
        </div>

        {/* GRAPH */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <h2 className="text-lg font-semibold mb-4 text-slate-200">GPA Trajectory</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" tick={{fontSize: 12}} />
                <YAxis domain={['dataMin - 0.2', 'auto']} stroke="#64748b" tick={{fontSize: 12}} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
                <Legend />
                <Line name="Max Potential" type="monotone" dataKey="maxPotential" stroke="#10b981" strokeDasharray="5 5" dot={false} />
                <Line name="Actual GPA" type="monotone" dataKey="gpa" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* TABLE */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center gap-2">
            <TableIcon className="w-5 h-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-200">Detailed Gradebook</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="text-xs uppercase bg-slate-950 border-b border-slate-800">
                  <th className="px-6 py-4 font-medium text-slate-400">Class Name</th>
                  {TERMS.map(term => {
                    const isSignificant = ["NW1", "NW2", "EX1", "SM1", "NW3", "NW4"].includes(term);
                    return (
                      <th key={term} className={`px-4 py-4 text-center ${isSignificant ? 'text-blue-300 font-bold' : 'text-slate-600 font-medium'}`}>
                        {term}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {studentData.map((course, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-200">{course.class_name}</td>
                    {TERMS.map(term => {
                      const grade = course.grades[term];
                      return (
                        <td key={term} className="px-4 py-4 text-center">
                          {grade ? (
                            <div className="flex flex-col items-center">
                              <span className={`text-lg font-bold ${grade.score >= 90 ? 'text-green-400' : grade.score >= 80 ? 'text-yellow-400' : 'text-red-400'}`}>
                                {grade.score}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-800">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default App;