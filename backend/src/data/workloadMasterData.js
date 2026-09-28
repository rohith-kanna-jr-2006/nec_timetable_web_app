/**
 * Faculty Workload Allocation Master Dataset & Services
 *
 * Authoritative Register of Current Faculty Workloads (27 Faculty Members: 25 CSE, 2 ECE).
 * Represents row-level teaching allocations and independent institutional responsibilities.
 *
 * NOTE: This is a standalone Master Faculty Workload Register.
 * It is NOT the timetable, NOT the AC handler pool, and NOT the HOD final timetable allocation.
 */

export const FACULTY_WORKLOAD_MASTER = [
  {
    facultyId: 'FWL-01',
    facultyName: 'Dr. T. Rajasekaran',
    designation: 'Professor & Head Of Department HOD',
    teaching: {
      ugTheory1: [
        {
          category: 'UG Theory 1',
          courseCode: '22CSX01',
          courseName: 'Deep Learning (PSE, Full Autonomy)',
          allocation: 'UG III Year B',
          hours: 3,
        },
      ],
      ugTheory2: [],
      lab1: [
        {
          category: 'Lab 1',
          courseCode: '22CSP09',
          courseName: 'Full Stack Development Laboratory',
          allocation: 'UG III Year A',
          hours: 4,
        },
      ],
      lab2: [],
      pg: [
        {
          category: 'PG',
          courseCode: '22CPE02',
          courseName: 'Project Phase I',
          allocation: 'PG II Year',
          hours: 1,
        },
      ],
      others: [],
    },
    responsibilities: [],
    sourceTotalHours: 8,
  },
  {
    facultyId: 'FWL-02',
    facultyName: 'M. P. Thiruvenkatasuresh',
    designation: 'Professor',
    teaching: {
      ugTheory1: [
        {
          category: 'UG Theory 1',
          courseCode: '22CSC06',
          courseName: 'Computer Networks',
          allocation: 'UG II Year C',
          hours: 3,
        },
      ],
      ugTheory2: [],
      lab1: [
        {
          category: 'Lab 1',
          courseCode: '22CSP05',
          courseName: 'Computer Networks Laboratory',
          allocation: 'UG II Year C',
          hours: 4,
        },
      ],
      lab2: [
        {
          category: 'Lab 2',
          courseCode: '22CSP05',
          courseName: 'Computer Networks Laboratory',
          allocation: 'UG II Year B',
          hours: 4,
        },
      ],
      pg: [
        {
          category: 'PG',
          courseCode: '22CPB01',
          courseName: 'Networking Technologies',
          allocation: 'PG I Year',
          hours: 1,
        },
      ],
      others: [
        {
          category: 'Others',
          courseCode: null,
          courseName: 'PBL',
          allocation: 'II Year B',
          hours: 2,
        },
        {
          category: 'Others',
          courseCode: null,
          courseName: 'Skill Development',
          allocation: 'II Year B',
          hours: 2,
        },
        {
          category: 'Others',
          courseCode: null,
          courseName: 'Indian Constitution',
          allocation: 'II Year C',
          hours: 1,
        },
      ],
    },
    responsibilities: [
      {
        category: 'RESPONSIBILITY',
        role: 'Overall Academic Coordinator',
        allocation: 'II Year',
        hours: 2,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'Class Advisor',
        allocation: 'II Year C',
        hours: 2,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'NBA Coordinator',
        allocation: null,
        hours: 3,
      },
    ],
    sourceTotalHours: 24,
  },
  {
    facultyId: 'FWL-03',
    facultyName: 'Dr. S. Karpusamy',
    designation: 'ASP',
    teaching: {
      ugTheory1: [
        {
          category: 'UG Theory 1',
          courseCode: '22CSC06',
          courseName: 'Computer Networks',
          allocation: 'UG II Year A',
          hours: 3,
        },
      ],
      ugTheory2: [
        {
          category: 'UG Theory 2',
          courseCode: '22CSC16',
          courseName: 'Object Oriented Software Engineering',
          allocation: 'UG III Year A',
          hours: 3,
        },
      ],
      lab1: [
        {
          category: 'Lab 1',
          courseCode: '22CSP05',
          courseName: 'Computer Networks Laboratory',
          allocation: 'UG II Year A',
          hours: 4,
        },
      ],
      lab2: [
        {
          category: 'Lab 2',
          courseCode: '22CSP10',
          courseName: 'Object Oriented Software Engineering Laboratory',
          allocation: 'UG III Year A',
          hours: 4,
        },
      ],
      pg: [
        {
          category: 'PG',
          courseCode: '22CPB03',
          courseName: 'Advanced Database Technology',
          allocation: 'PG I Year',
          hours: 1,
        },
      ],
      others: [],
    },
    responsibilities: [
      {
        category: 'RESPONSIBILITY',
        role: 'Class Advisor',
        allocation: 'II Year A',
        hours: 2,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'Student Affairs Coordinator',
        allocation: null,
        hours: 2,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'Admin Coordinator',
        allocation: null,
        hours: 3,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'CCI Lab Incharge',
        allocation: null,
        hours: 1,
      },
    ],
    sourceTotalHours: 23,
  },
  {
    facultyId: 'FWL-04',
    facultyName: 'Dr. A. Manchula',
    designation: 'AP',
    teaching: {
      ugTheory1: [
        {
          category: 'UG Theory 1',
          courseCode: '22CSC14',
          courseName: 'Principles of Compiler Design',
          allocation: 'UG III Year A',
          hours: 4,
        },
      ],
      ugTheory2: [
        {
          category: 'UG Theory 2',
          courseCode: '22CSC14',
          courseName: 'Principles of Compiler Design',
          allocation: 'UG III Year B',
          hours: 4,
        },
      ],
      lab1: [
        {
          category: 'Lab 1',
          courseCode: '22CSC16',
          courseName: 'Object Oriented Software Engineering Laboratory',
          allocation: 'UG III Year A',
          hours: 4,
        },
      ],
      lab2: [
        {
          category: 'Lab 2',
          courseCode: '22CSC16',
          courseName: 'Object Oriented Software Engineering Laboratory',
          allocation: 'UG III Year B',
          hours: 4,
        },
      ],
      pg: [
        {
          category: 'PG',
          courseCode: '22CPX18',
          courseName: 'Virtualization Techniques',
          allocation: 'PG II Year',
          hours: 1,
        },
      ],
      others: [],
    },
    responsibilities: [
      {
        category: 'RESPONSIBILITY',
        role: 'Dept. CIPD Coordinator',
        allocation: null,
        hours: 3,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'Proctor',
        allocation: 'II Year',
        hours: 2,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'Class Advisor',
        allocation: 'I Year M.E.',
        hours: 1,
      },
    ],
    sourceTotalHours: 23,
  },
  {
    facultyId: 'FWL-05',
    facultyName: 'C. Mani',
    designation: 'AP (Website)',
    teaching: {
      ugTheory1: [
        {
          category: 'UG Theory 1',
          courseCode: '22CSC01',
          courseName: 'Problem Solving and C Programming',
          allocation: 'UG I Year A',
          hours: 3,
        },
      ],
      ugTheory2: [
        {
          category: 'UG Theory 2',
          courseCode: '22CSC01',
          courseName: 'Problem Solving and C Programming',
          allocation: 'UG I Year B',
          hours: 3,
        },
      ],
      lab1: [
        {
          category: 'Lab 1',
          courseCode: '22CSP01',
          courseName: 'Problem Solving and C Programming Laboratory',
          allocation: 'UG I Year A',
          hours: 4,
        },
      ],
      lab2: [
        {
          category: 'Lab 2',
          courseCode: '22CSP01',
          courseName: 'Problem Solving and C Programming Laboratory',
          allocation: 'UG I Year B',
          hours: 4,
        },
      ],
      pg: [],
      others: [],
    },
    responsibilities: [
      {
        category: 'RESPONSIBILITY',
        role: 'Dept. Infrastructure / Maintenance / Furniture',
        allocation: null,
        hours: 3,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'Proctor',
        allocation: 'II Year',
        hours: 2,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'Institute Social Media and Website Updation',
        allocation: null,
        hours: 1,
      },
    ],
    sourceTotalHours: 20,
  },
  {
    facultyId: 'FWL-06',
    facultyName: 'Mrs. E. Padma',
    designation: 'AP',
    teaching: {
      ugTheory1: [
        {
          category: 'UG Theory 1',
          courseCode: '22CSC05',
          courseName: 'Algorithms',
          allocation: 'UG II Year A',
          hours: 3,
        },
      ],
      ugTheory2: [
        {
          category: 'UG Theory 2',
          courseCode: '22CSX42',
          courseName: 'UI and UX Design (PSE)',
          allocation: 'UG III Year A',
          hours: 3,
        },
      ],
      lab1: [
        {
          category: 'Lab 1',
          courseCode: '22CSP04',
          courseName: 'Algorithms Laboratory',
          allocation: 'UG III Year A',
          hours: 4,
        },
      ],
      lab2: [
        {
          category: 'Lab 2',
          courseCode: '22CSP04',
          courseName: 'Algorithms Laboratory',
          allocation: 'UG III Year B',
          hours: 4,
        },
      ],
      pg: [
        {
          category: 'PG',
          courseCode: '22CPP1',
          courseName: 'Advanced Data Structures Laboratory',
          allocation: 'PG I Year',
          hours: 1,
        },
      ],
      others: [
        {
          category: 'Others',
          courseCode: null,
          courseName: 'Library/NPTEL',
          allocation: 'II Year',
          hours: 1,
        },
        {
          category: 'Others',
          courseCode: null,
          courseName: 'PBL',
          allocation: 'III Year D',
          hours: 2,
        },
      ],
    },
    responsibilities: [
      {
        category: 'RESPONSIBILITY',
        role: 'PAC, DAB, BoS Coordinator',
        allocation: null,
        hours: 3,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'Overall Academic Coordinator',
        allocation: 'II Year',
        hours: 2,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'Class Advisor',
        allocation: 'III Year A',
        hours: 2,
      },
    ],
    sourceTotalHours: 25,
  },
  {
    facultyId: 'FWL-07',
    facultyName: 'Mrs. P. Uma',
    designation: 'AP',
    teaching: {
      ugTheory1: [
        {
          category: 'UG Theory 1',
          courseCode: '22CSC07',
          courseName: 'Java Programming',
          allocation: 'UG II Year CS/IOT',
          hours: 4,
        },
      ],
      ugTheory2: [
        {
          category: 'UG Theory 2',
          courseCode: '22CSP06',
          courseName: 'Java Programming Laboratory',
          allocation: 'UG II Year CS/IOT',
          hours: 3,
        },
      ],
      lab1: [
        {
          category: 'Lab 1',
          courseCode: '22CSP06',
          courseName: 'Java Programming Laboratory',
          allocation: 'UG II Year B',
          hours: 3,
        },
      ],
      lab2: [
        {
          category: 'Lab 2',
          courseCode: '22CSP06',
          courseName: 'Java Programming Laboratory',
          allocation: 'UG II Year C',
          hours: 3,
        },
      ],
      pg: [
        {
          category: 'PG',
          courseCode: '22CPB05',
          courseName: 'Machine Learning Techniques',
          allocation: 'PG I Year',
          hours: 1,
        },
      ],
      others: [
        {
          category: 'Others',
          courseCode: '22MAN09',
          courseName: 'Indian Constitution',
          allocation: 'UG II Year D',
          hours: 1,
        },
      ],
    },
    responsibilities: [
      {
        category: 'RESPONSIBILITY',
        role: 'P&EA Coordinator',
        allocation: null,
        hours: 2,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'Proctor',
        allocation: 'II Year',
        hours: 2,
      },
    ],
    sourceTotalHours: 19,
  },
  {
    facultyId: 'FWL-08',
    facultyName: 'Mrs. K. Shanmugapriya',
    designation: 'AP',
    teaching: {
      ugTheory1: [
        {
          category: 'UG Theory 1',
          courseCode: '22CSC14',
          courseName: 'Principles of Compiler Design',
          allocation: 'UG III Year C',
          hours: 4,
        },
      ],
      ugTheory2: [
        {
          category: 'UG Theory 2',
          courseCode: '22CSC14',
          courseName: 'Principles of Compiler Design',
          allocation: 'UG III Year D',
          hours: 4,
        },
      ],
      lab1: [
        {
          category: 'Lab 1',
          courseCode: '22CSP09',
          courseName: 'Full Stack Development Laboratory',
          allocation: 'UG III Year C',
          hours: 4,
        },
      ],
      lab2: [
        {
          category: 'Lab 2',
          courseCode: '22CSP09',
          courseName: 'Full Stack Development Laboratory',
          allocation: 'UG III Year D',
          hours: 4,
        },
      ],
      pg: [
        {
          category: 'PG',
          courseCode: '22CPX17',
          courseName: 'Pattern Recognition',
          allocation: 'PG II Year',
          hours: 1,
        },
      ],
      others: [],
    },
    responsibilities: [
      {
        category: 'RESPONSIBILITY',
        role: 'Dept. CIPD Coordinator',
        allocation: null,
        hours: 3,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'Proctor',
        allocation: 'III Year',
        hours: 2,
      },
    ],
    sourceTotalHours: 22,
  },
  {
    facultyId: 'FWL-09',
    facultyName: 'Mrs. B. Deepa',
    designation: 'AP',
    teaching: {
      ugTheory1: [
        {
          category: 'UG Theory 1',
          courseCode: '22CSC05',
          courseName: 'Algorithms',
          allocation: 'UG III Year D',
          hours: 3,
        },
      ],
      ugTheory2: [
        {
          category: 'UG Theory 2',
          courseCode: '22CSX01',
          courseName: 'Deep Learning (PSE, Full Autonomy)',
          allocation: 'UG III Year B',
          hours: 3,
        },
      ],
      lab1: [
        {
          category: 'Lab 1',
          courseCode: '22CSP04',
          courseName: 'Algorithms Laboratory',
          allocation: 'UG III Year D',
          hours: 4,
        },
      ],
      lab2: [
        {
          category: 'Lab 2',
          courseCode: '22CSP04',
          courseName: 'Algorithms Laboratory',
          allocation: 'UG III Year A',
          hours: 4,
        },
      ],
      pg: [
        {
          category: 'PG',
          courseCode: '22CPB02',
          courseName: 'Advanced Data Structures and Algorithms',
          allocation: 'PG I Year',
          hours: 1,
        },
      ],
      others: [
        {
          category: 'Others',
          courseCode: null,
          courseName: 'Skill Development',
          allocation: 'III Year A',
          hours: 2,
        },
      ],
    },
    responsibilities: [
      {
        category: 'RESPONSIBILITY',
        role: 'Overall Academic Coordinator',
        allocation: 'IV Year',
        hours: 2,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'Class Advisor',
        allocation: 'IV Year B',
        hours: 2,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'NAAC/NBA Coordinator',
        allocation: null,
        hours: 3,
      },
    ],
    sourceTotalHours: 24,
  },
  {
    facultyId: 'FWL-10',
    facultyName: 'Mrs. C. Navamani',
    designation: 'AP',
    teaching: {
      ugTheory1: [
        {
          category: 'UG Theory 1',
          courseCode: '22CSC06',
          courseName: 'Computer Networks',
          allocation: 'UG II Year D',
          hours: 3,
        },
      ],
      ugTheory2: [
        {
          category: 'UG Theory 2',
          courseCode: '22CSX42',
          courseName: 'UI and UX Design (PSE)',
          allocation: 'UG III Year C',
          hours: 3,
        },
      ],
      lab1: [
        {
          category: 'Lab 1',
          courseCode: '22CSP05',
          courseName: 'Computer Networks Laboratory',
          allocation: 'UG III Year D',
          hours: 4,
        },
      ],
      lab2: [
        {
          category: 'Lab 2',
          courseCode: '22CSP05',
          courseName: 'Computer Networks Laboratory',
          allocation: 'UG II Year B',
          hours: 4,
        },
      ],
      pg: [
        {
          category: 'PG',
          courseCode: '22CPB04',
          courseName: 'Multicore Architecture and Programming',
          allocation: 'PG I Year',
          hours: 1,
        },
      ],
      others: [
        {
          category: 'Others',
          courseCode: null,
          courseName: 'Skill Development',
          allocation: 'III Year D',
          hours: 2,
        },
        {
          category: 'Others',
          courseCode: null,
          courseName: 'PBL',
          allocation: 'III Year A',
          hours: 2,
        },
      ],
    },
    responsibilities: [
      {
        category: 'RESPONSIBILITY',
        role: 'Class Advisor',
        allocation: 'II Year D',
        hours: 2,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'PCD Club',
        allocation: null,
        hours: 1,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'AI Affiliation/AICTE Work',
        allocation: null,
        hours: 1,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'Faculty Achievements',
        allocation: null,
        hours: 1,
      },
    ],
    sourceTotalHours: 24,
  },
  {
    facultyId: 'FWL-11',
    facultyName: 'Mr. S. Jagadeesan',
    designation: 'AP (DCOE)',
    teaching: {
      ugTheory1: [
        {
          category: 'UG Theory 1',
          courseCode: '22CSC06',
          courseName: 'Computer Networks',
          allocation: 'UG II Year B',
          hours: 3,
        },
      ],
      ugTheory2: [],
      lab1: [
        {
          category: 'Lab 1',
          courseCode: '22CSP05',
          courseName: 'Computer Networks Laboratory',
          allocation: 'UG II Year B',
          hours: 4,
        },
      ],
      lab2: [],
      pg: [],
      others: [
        {
          category: 'Others',
          courseCode: '22MAN09',
          courseName: 'Indian Constitution',
          allocation: 'UG II Year B',
          hours: 1,
        },
      ],
    },
    responsibilities: [
      {
        category: 'RESPONSIBILITY',
        role: 'DCOE',
        allocation: null,
        hours: 5,
      },
    ],
    sourceTotalHours: 13,
  },
  {
    facultyId: 'FWL-12',
    facultyName: 'Mrs. K. Eswari',
    designation: 'AP',
    teaching: {
      ugTheory1: [
        {
          category: 'UG Theory 1',
          courseCode: '22CSX21',
          courseName: 'Fundamentals of Cryptography and Network Security (PSE)',
          allocation: 'UG III Year A',
          hours: 3,
        },
      ],
      ugTheory2: [
        {
          category: 'UG Theory 2',
          courseCode: '22CSX21',
          courseName: 'Fundamentals of Cryptography and Network Security (PSE)',
          allocation: 'UG III Year C',
          hours: 3,
        },
      ],
      lab1: [
        {
          category: 'Lab 1',
          courseCode: '22CSP05',
          courseName: 'Computer Networks Laboratory',
          allocation: 'UG III Year A',
          hours: 4,
        },
      ],
      lab2: [
        {
          category: 'Lab 2',
          courseCode: '22CSP05',
          courseName: 'Computer Networks Laboratory',
          allocation: 'UG III Year C',
          hours: 4,
        },
      ],
      pg: [],
      others: [
        {
          category: 'Others',
          courseCode: null,
          courseName: 'Indian Constitution',
          allocation: 'II Year A',
          hours: 1,
        },
        {
          category: 'Others',
          courseCode: null,
          courseName: 'PBL',
          allocation: 'III Year A',
          hours: 2,
        },
      ],
    },
    responsibilities: [
      {
        category: 'RESPONSIBILITY',
        role: 'Dept. Exam Cell I/C',
        allocation: null,
        hours: 1,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'Proctor',
        allocation: 'IV Year',
        hours: 2,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'PCD Club',
        allocation: null,
        hours: 1,
      },
    ],
    sourceTotalHours: 21,
  },
  {
    facultyId: 'FWL-13',
    facultyName: 'Mrs. N. M. Indumathi',
    designation: 'AP',
    teaching: {
      ugTheory1: [
        {
          category: 'UG Theory 1',
          courseCode: '22CSC16',
          courseName: 'Object Oriented Software Engineering',
          allocation: 'UG III Year B',
          hours: 3,
        },
      ],
      ugTheory2: [
        {
          category: 'UG Theory 2',
          courseCode: '22CSC16',
          courseName: 'Object Oriented Software Engineering',
          allocation: 'UG III Year C',
          hours: 3,
        },
      ],
      lab1: [
        {
          category: 'Lab 1',
          courseCode: '22CSP10',
          courseName: 'Object Oriented Software Engineering Laboratory',
          allocation: 'UG III Year B',
          hours: 4,
        },
      ],
      lab2: [
        {
          category: 'Lab 2',
          courseCode: '22CSP10',
          courseName: 'Object Oriented Software Engineering Laboratory',
          allocation: 'UG III Year C',
          hours: 4,
        },
      ],
      pg: [],
      others: [],
    },
    responsibilities: [
      {
        category: 'RESPONSIBILITY',
        role: 'Proctor',
        allocation: 'IV Year',
        hours: 2,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'PCD Club',
        allocation: null,
        hours: 1,
      },
    ],
    sourceTotalHours: 17,
  },
  {
    facultyId: 'FWL-14',
    facultyName: 'Ms. D. Vinoparkavi',
    designation: 'AP',
    teaching: {
      ugTheory1: [
        {
          category: 'UG Theory 1',
          courseCode: '22CSC15',
          courseName: 'Full Stack Development (PBL)',
          allocation: 'UG III Year A',
          hours: 3,
        },
      ],
      ugTheory2: [
        {
          category: 'UG Theory 2',
          courseCode: '22CSC15',
          courseName: 'Full Stack Development (PBL)',
          allocation: 'UG III Year B',
          hours: 3,
        },
      ],
      lab1: [
        {
          category: 'Lab 1',
          courseCode: '22CSP09',
          courseName: 'Full Stack Development Laboratory',
          allocation: 'UG III Year A',
          hours: 4,
        },
      ],
      lab2: [
        {
          category: 'Lab 2',
          courseCode: '22CSP09',
          courseName: 'Full Stack Development Laboratory',
          allocation: 'UG III Year B',
          hours: 4,
        },
      ],
      pg: [],
      others: [
        {
          category: 'Others',
          courseCode: null,
          courseName: 'Skill Development',
          allocation: 'II Year B',
          hours: 2,
        },
        {
          category: 'Others',
          courseCode: null,
          courseName: 'PBL',
          allocation: 'III Year B',
          hours: 2,
        },
      ],
    },
    responsibilities: [
      {
        category: 'RESPONSIBILITY',
        role: 'Class Advisor',
        allocation: 'II Year B',
        hours: 2,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'Dept. Newsletter/Magazine',
        allocation: null,
        hours: 1,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'Alumni & Higher Studies',
        allocation: null,
        hours: 2,
      },
    ],
    sourceTotalHours: 23,
  },
  {
    facultyId: 'FWL-15',
    facultyName: 'Mrs. P. Devika',
    designation: 'AP',
    teaching: {
      ugTheory1: [
        {
          category: 'UG Theory 1',
          courseCode: '22CSC05',
          courseName: 'Algorithms',
          allocation: 'UG II Year C',
          hours: 3,
        },
      ],
      ugTheory2: [
        {
          category: 'UG Theory 2',
          courseCode: '22CSX42',
          courseName: 'UI and UX Design (PSE)',
          allocation: 'UG III Year B',
          hours: 3,
        },
      ],
      lab1: [
        {
          category: 'Lab 1',
          courseCode: '22CSP04',
          courseName: 'Algorithms Laboratory',
          allocation: 'UG III Year C',
          hours: 4,
        },
      ],
      lab2: [
        {
          category: 'Lab 2',
          courseCode: '22CSP04',
          courseName: 'Algorithms Laboratory',
          allocation: 'UG III Year D',
          hours: 4,
        },
      ],
      pg: [],
      others: [
        {
          category: 'Others',
          courseCode: null,
          courseName: 'NPTEL',
          allocation: 'III Year B',
          hours: 1,
        },
      ],
    },
    responsibilities: [
      {
        category: 'RESPONSIBILITY',
        role: 'PAC, DAB, BoS Coordinator',
        allocation: null,
        hours: 3,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'Class Advisor',
        allocation: 'III Year B',
        hours: 2,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'Dept. Meeting Minutes',
        allocation: null,
        hours: 1,
      },
    ],
    sourceTotalHours: 21,
  },
  {
    facultyId: 'FWL-16',
    facultyName: 'Mrs. S. Geetha',
    designation: 'AP',
    teaching: {
      ugTheory1: [
        {
          category: 'UG Theory 1',
          courseCode: '22CSC08',
          courseName: 'Operating Systems',
          allocation: 'UG II Year A',
          hours: 3,
        },
      ],
      ugTheory2: [
        {
          category: 'UG Theory 2',
          courseCode: '22CSX01',
          courseName: 'Deep Learning (PSE, Full Autonomy)',
          allocation: 'UG III Year B',
          hours: 3,
        },
      ],
      lab1: [
        {
          category: 'Lab 1',
          courseCode: '22CSP05',
          courseName: 'Computer Networks Laboratory',
          allocation: 'UG II Year A',
          hours: 4,
        },
      ],
      lab2: [
        {
          category: 'Lab 2',
          courseCode: '22CSP05',
          courseName: 'Computer Networks Laboratory',
          allocation: 'UG II Year D',
          hours: 4,
        },
      ],
      pg: [],
      others: [
        {
          category: 'Others',
          courseCode: null,
          courseName: 'Skill Development',
          allocation: 'III Year C',
          hours: 2,
        },
        {
          category: 'Others',
          courseCode: null,
          courseName: 'PBL',
          allocation: 'III Year C',
          hours: 2,
        },
      ],
    },
    responsibilities: [
      {
        category: 'RESPONSIBILITY',
        role: 'Class Advisor',
        allocation: 'IV Year A',
        hours: 2,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'NIRF/IQAC Coordinator',
        allocation: null,
        hours: 1,
      },
    ],
    sourceTotalHours: 21,
  },
  {
    facultyId: 'FWL-17',
    facultyName: 'Mrs. P. Savitha',
    designation: 'AP',
    teaching: {
      ugTheory1: [
        {
          category: 'UG Theory 1',
          courseCode: '22CSC05',
          courseName: 'Algorithms',
          allocation: 'UG II Year B',
          hours: 3,
        },
      ],
      ugTheory2: [
        {
          category: 'UG Theory 2',
          courseCode: '22CSX42',
          courseName: 'UI and UX Design (PSE)',
          allocation: 'UG III Year D',
          hours: 3,
        },
      ],
      lab1: [
        {
          category: 'Lab 1',
          courseCode: '22CSP04',
          courseName: 'Algorithms Laboratory',
          allocation: 'UG II Year B',
          hours: 4,
        },
      ],
      lab2: [
        {
          category: 'Lab 2',
          courseCode: '22CSP04',
          courseName: 'Algorithms Laboratory',
          allocation: 'UG II Year C',
          hours: 4,
        },
      ],
      pg: [],
      others: [
        {
          category: 'Others',
          courseCode: null,
          courseName: 'Library/NPTEL',
          allocation: 'II Year B',
          hours: 1,
        },
        {
          category: 'Others',
          courseCode: null,
          courseName: 'PBL',
          allocation: 'III Year D',
          hours: 2,
        },
      ],
    },
    responsibilities: [
      {
        category: 'RESPONSIBILITY',
        role: 'Class Advisor',
        allocation: 'II Year D',
        hours: 2,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'Timetable I/C',
        allocation: null,
        hours: 2,
      },
    ],
    sourceTotalHours: 21,
  },
  {
    facultyId: 'FWL-18',
    facultyName: 'Mrs. V. Mythily',
    designation: 'AP',
    teaching: {
      ugTheory1: [
        {
          category: 'UG Theory 1',
          courseCode: '22CSC08',
          courseName: 'Operating Systems',
          allocation: 'UG III Year C',
          hours: 3,
        },
      ],
      ugTheory2: [
        {
          category: 'UG Theory 2',
          courseCode: '22CSX01',
          courseName: 'Deep Learning (PSE, Full Autonomy)',
          allocation: 'UG III Year B',
          hours: 3,
        },
      ],
      lab1: [
        {
          category: 'Lab 1',
          courseCode: '22CSP04',
          courseName: 'Algorithms Laboratory',
          allocation: 'UG III Year C',
          hours: 4,
        },
      ],
      lab2: [
        {
          category: 'Lab 2',
          courseCode: '22CSP10',
          courseName: 'Object Oriented Software Engineering Laboratory',
          allocation: 'UG III Year D',
          hours: 4,
        },
      ],
      pg: [],
      others: [
        {
          category: 'Others',
          courseCode: null,
          courseName: 'Skill Development',
          allocation: 'II Year C',
          hours: 2,
        },
        {
          category: 'Others',
          courseCode: null,
          courseName: 'PBL',
          allocation: 'III Year C',
          hours: 2,
        },
      ],
    },
    responsibilities: [
      {
        category: 'RESPONSIBILITY',
        role: 'NPTEL Online Courses (Faculty & Students)',
        allocation: null,
        hours: 1,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'Proctor',
        allocation: 'III Year B',
        hours: 2,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'One Credit Course',
        allocation: null,
        hours: 1,
      },
    ],
    sourceTotalHours: 22,
  },
  {
    facultyId: 'FWL-19',
    facultyName: 'Mr. D. Kavin Kumar',
    designation: 'AP (Placement)',
    teaching: {
      ugTheory1: [
        {
          category: 'UG Theory 1',
          courseCode: '22CSX21',
          courseName: 'Fundamentals of Cryptography and Network Security (PSE)',
          allocation: 'UG III Year B',
          hours: 3,
        },
      ],
      ugTheory2: [],
      lab1: [
        {
          category: 'Lab 1',
          courseCode: '22CSP09',
          courseName: 'Full Stack Development Laboratory',
          allocation: 'UG III Year B',
          hours: 4,
        },
      ],
      lab2: [
        {
          category: 'Lab 2',
          courseCode: '22GED02',
          courseName: 'Internship / Industrial Training',
          allocation: 'UG IV Year',
          hours: 4,
        },
      ],
      pg: [],
      others: [
        {
          category: 'Others',
          courseCode: null,
          courseName: 'Skill Development',
          allocation: 'IV Year D',
          hours: 2,
        },
      ],
    },
    responsibilities: [
      {
        category: 'RESPONSIBILITY',
        role: 'Class Advisor',
        allocation: 'IV Year C',
        hours: 2,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'CC1 Lab I/C',
        allocation: null,
        hours: 1,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'Placement Coordinator',
        allocation: null,
        hours: 3,
      },
    ],
    sourceTotalHours: 19,
  },
  {
    facultyId: 'FWL-20',
    facultyName: 'Mrs. A. Satheesh Kumar',
    designation: 'AP',
    teaching: {
      ugTheory1: [],
      ugTheory2: [],
      lab1: [],
      lab2: [],
      pg: [],
      others: [],
    },
    responsibilities: [
      {
        category: 'RESPONSIBILITY',
        role: 'TECH GURU',
        allocation: 'Source allocation: TECH GURU',
        hours: null, // NOT SPECIFIED / NOT LEGIBLE IN SOURCE (DO NOT GUESS 0)
      },
    ],
    sourceTotalHours: null, // NOT SPECIFIED / NOT LEGIBLE IN SOURCE
    isIncomplete: true,
    incompleteReason: 'Total hours and individual allocation hours not specified or legible in source record.',
  },
  {
    facultyId: 'FWL-21',
    facultyName: 'Mrs. J. Radha',
    designation: 'AP',
    teaching: {
      ugTheory1: [
        {
          category: 'UG Theory 1',
          courseCode: '22CSC01',
          courseName: 'Problem Solving and C Programming',
          allocation: 'UG I Year C',
          hours: 3,
        },
      ],
      ugTheory2: [
        {
          category: 'UG Theory 2',
          courseCode: '22CSC01',
          courseName: 'Problem Solving and C Programming',
          allocation: 'UG I Year D',
          hours: 3,
        },
      ],
      lab1: [
        {
          category: 'Lab 1',
          courseCode: '22CSP01',
          courseName: 'Problem Solving and C Programming Laboratory',
          allocation: 'UG I Year C',
          hours: 4,
        },
      ],
      lab2: [
        {
          category: 'Lab 2',
          courseCode: '22CSP01',
          courseName: 'Problem Solving and C Programming Laboratory',
          allocation: 'UG I Year D',
          hours: 4,
        },
      ],
      pg: [
        {
          category: 'PG',
          courseCode: '22CPX14',
          courseName: 'GPU Computing',
          allocation: 'PG II Year',
          hours: 1,
        },
      ],
      others: [],
    },
    responsibilities: [
      {
        category: 'RESPONSIBILITY',
        role: 'Proctor',
        allocation: 'III Year C',
        hours: 2,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'Student Exit Survey',
        allocation: null,
        hours: 1,
      },
    ],
    sourceTotalHours: 18,
  },
  {
    facultyId: 'FWL-22',
    facultyName: 'Mr. R. Manikandan',
    designation: 'AP',
    teaching: {
      ugTheory1: [
        {
          category: 'UG Theory 1',
          courseCode: '22CSC15',
          courseName: 'Full Stack Development (PBL)',
          allocation: 'UG III Year C',
          hours: 3,
        },
      ],
      ugTheory2: [
        {
          category: 'UG Theory 2',
          courseCode: '22CSC15',
          courseName: 'Full Stack Development (PBL)',
          allocation: 'UG III Year D',
          hours: 3,
        },
      ],
      lab1: [
        {
          category: 'Lab 1',
          courseCode: '22CSP09',
          courseName: 'Full Stack Development Laboratory',
          allocation: 'UG III Year C',
          hours: 4,
        },
      ],
      lab2: [
        {
          category: 'Lab 2',
          courseCode: '22CSP09',
          courseName: 'Full Stack Development Laboratory',
          allocation: 'UG III Year D',
          hours: 4,
        },
      ],
      pg: [],
      others: [
        {
          category: 'Others',
          courseCode: null,
          courseName: 'NPTEL',
          allocation: 'III Year D',
          hours: 1,
        },
      ],
    },
    responsibilities: [
      {
        category: 'RESPONSIBILITY',
        role: 'Class Advisor',
        allocation: 'III Year C',
        hours: 2,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'Industrial Relations Coordinator',
        allocation: null,
        hours: 2,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'PCD Club',
        allocation: null,
        hours: 1,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'MOU/Internship',
        allocation: null,
        hours: 1,
      },
    ],
    sourceTotalHours: 21,
  },
  {
    facultyId: 'FWL-23',
    facultyName: 'Ms. N. Bhuvaneswari',
    designation: 'AP',
    teaching: {
      ugTheory1: [
        {
          category: 'UG Theory 1',
          courseCode: '22CSC08',
          courseName: 'Operating Systems',
          allocation: 'UG II Year B',
          hours: 3,
        },
      ],
      ugTheory2: [
        {
          category: 'UG Theory 2',
          courseCode: '22CSC16',
          courseName: 'Object Oriented Software Engineering',
          allocation: 'UG III Year D',
          hours: 3,
        },
      ],
      lab1: [
        {
          category: 'Lab 1',
          courseCode: '22CSP10',
          courseName: 'Object Oriented Software Engineering Laboratory',
          allocation: 'UG III Year D',
          hours: 4,
        },
      ],
      lab2: [
        {
          category: 'Lab 2',
          courseCode: '22CSP10',
          courseName: 'Object Oriented Software Engineering Laboratory',
          allocation: 'UG III Year C',
          hours: 4,
        },
      ],
      pg: [],
      others: [
        {
          category: 'Others',
          courseCode: null,
          courseName: 'NPTEL',
          allocation: 'III Year C',
          hours: 1,
        },
        {
          category: 'Others',
          courseCode: null,
          courseName: 'PBL',
          allocation: 'III Year B',
          hours: 2,
        },
        {
          category: 'Others',
          courseCode: null,
          courseName: 'NPTEL',
          allocation: 'III Year D',
          hours: 1,
        },
      ],
    },
    responsibilities: [
      {
        category: 'RESPONSIBILITY',
        role: 'Timetable Coordinator',
        allocation: null,
        hours: 1,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'Proctor',
        allocation: 'IV Year',
        hours: 2,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'PCD Club',
        allocation: null,
        hours: 1,
      },
    ],
    sourceTotalHours: 22,
  },
  {
    facultyId: 'FWL-24',
    facultyName: 'Mr. K. U. Ranjith',
    designation: 'AP (Placement)',
    teaching: {
      ugTheory1: [
        {
          category: 'UG Theory 1',
          courseCode: '22CSX21',
          courseName: 'Fundamentals of Cryptography and Network Security (PSE)',
          allocation: 'UG III Year D',
          hours: 3,
        },
      ],
      ugTheory2: [
        {
          category: 'UG Theory 2',
          courseCode: null,
          courseName: 'Universal Human Values',
          allocation: 'UG IV Year',
          hours: 3,
        },
      ],
      lab1: [
        {
          category: 'Lab 1',
          courseCode: '22CSP05',
          courseName: 'Computer Networks Laboratory',
          allocation: 'UG III Year D',
          hours: 4,
        },
      ],
      lab2: [],
      pg: [],
      others: [],
    },
    responsibilities: [
      {
        category: 'RESPONSIBILITY',
        role: 'CC1 Lab Incharge',
        allocation: null,
        hours: 1,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'Class Advisor',
        allocation: 'I Year M.E.',
        hours: 1,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'Proctor',
        allocation: 'IV Year A',
        hours: 2,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'Placement Coordinator',
        allocation: null,
        hours: 3,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'Dept. Association',
        allocation: null,
        hours: 1,
      },
    ],
    sourceTotalHours: 18,
  },
  {
    facultyId: 'FWL-25',
    facultyName: 'Ms. M. Sowmya',
    designation: 'AP',
    teaching: {
      ugTheory1: [
        {
          category: 'UG Theory 1',
          courseCode: '22CSC08',
          courseName: 'Operating Systems',
          allocation: 'UG IV Year D',
          hours: 3,
        },
      ],
      ugTheory2: [
        {
          category: 'UG Theory 2',
          courseCode: null,
          courseName: 'Ethics of AI',
          allocation: 'UG IV Year',
          hours: 3,
        },
      ],
      lab1: [
        {
          category: 'Lab 1',
          courseCode: '22CSP04',
          courseName: 'Algorithms Laboratory',
          allocation: 'UG III Year B',
          hours: 4,
        },
      ],
      lab2: [
        {
          category: 'Lab 2',
          courseCode: '22CSP04',
          courseName: 'Algorithms Laboratory',
          allocation: 'UG III Year D',
          hours: 4,
        },
      ],
      pg: [],
      others: [
        {
          category: 'Others',
          courseCode: null,
          courseName: 'NPTEL',
          allocation: 'III Year A',
          hours: 1,
        },
        {
          category: 'Others',
          courseCode: null,
          courseName: 'Skill Development',
          allocation: 'III Year C',
          hours: 2,
        },
      ],
    },
    responsibilities: [
      {
        category: 'RESPONSIBILITY',
        role: 'Proctor',
        allocation: 'III Year B',
        hours: 2,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'Student Achievements',
        allocation: null,
        hours: 1,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'Professional Society/Chapter',
        allocation: null,
        hours: 1,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'NIRF/IQAC Coordinator',
        allocation: null,
        hours: 1,
      },
    ],
    sourceTotalHours: 22,
  },
  {
    facultyId: 'FWL-26',
    facultyName: 'Dr. R. Praveenkumar',
    designation: 'ASP / ECE',
    teaching: {
      ugTheory1: [
        {
          category: 'UG Theory 1',
          courseCode: null,
          courseName: 'Basics of Electrical and Electronics Engineering',
          allocation: 'UG I Year A',
          hours: 3,
        },
      ],
      ugTheory2: [
        {
          category: 'UG Theory 2',
          courseCode: null,
          courseName: 'Basics of Electrical and Electronics Engineering',
          allocation: 'UG I Year B',
          hours: 3,
        },
      ],
      lab1: [
        {
          category: 'Lab 1',
          courseCode: '22GEA01',
          courseName: 'Universal Human Values',
          allocation: 'UG IV Year',
          hours: 3,
        },
      ],
      lab2: [],
      pg: [],
      others: [
        {
          category: 'Others',
          courseCode: null,
          courseName: 'Skill Development',
          allocation: 'II Year C',
          hours: 2,
        },
        {
          category: 'Others',
          courseCode: null,
          courseName: 'PBL',
          allocation: 'III Year D',
          hours: 2,
        },
      ],
    },
    responsibilities: [
      {
        category: 'RESPONSIBILITY',
        role: 'Dept. CFiR and RSD Coordinator',
        allocation: null,
        hours: 3,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'Proctor',
        allocation: 'I Year B',
        hours: 2,
      },
    ],
    sourceTotalHours: 18,
  },
  {
    facultyId: 'FWL-27',
    facultyName: 'Ms. B. Preethi',
    designation: 'AP / ECE',
    teaching: {
      ugTheory1: [
        {
          category: 'UG Theory 1',
          courseCode: null,
          courseName: 'Basics of Electrical and Electronics Engineering',
          allocation: 'UG I Year C',
          hours: 3,
        },
      ],
      ugTheory2: [
        {
          category: 'UG Theory 2',
          courseCode: null,
          courseName: 'Basics of Electrical and Electronics Engineering',
          allocation: 'UG I Year D',
          hours: 3,
        },
      ],
      lab1: [
        {
          category: 'Lab 1',
          courseCode: '22GEA01',
          courseName: 'Universal Human Values',
          allocation: 'UG IV Year',
          hours: 3,
        },
      ],
      lab2: [],
      pg: [],
      others: [
        {
          category: 'Others',
          courseCode: null,
          courseName: 'Skill Development',
          allocation: 'II Year B',
          hours: 2,
        },
        {
          category: 'Others',
          courseCode: null,
          courseName: 'Library/NPTEL',
          allocation: 'II Year A',
          hours: 1,
        },
        {
          category: 'Others',
          courseCode: null,
          courseName: 'PBL',
          allocation: null,
          hours: 2,
        },
      ],
    },
    responsibilities: [
      {
        category: 'RESPONSIBILITY',
        role: 'Proctor',
        allocation: 'II Year C',
        hours: 2,
      },
      {
        category: 'RESPONSIBILITY',
        role: 'Startups & Business Incubation / Entrepreneur',
        allocation: null,
        hours: 1,
      },
    ],
    sourceTotalHours: 17,
  },
];

// ------------------------------------------------------------
// Helper Calculation Functions
// ------------------------------------------------------------

/**
 * Calculates total teaching hours for a faculty record.
 */
export function calculateTeachingHours(teaching = {}) {
  let sum = 0;
  Object.values(teaching).forEach((itemList) => {
    if (Array.isArray(itemList)) {
      itemList.forEach((item) => {
        sum += item.hours || 0;
      });
    }
  });
  return sum;
}

/**
 * Calculates total responsibility hours for a faculty record.
 */
export function calculateResponsibilityHours(responsibilities = []) {
  let sum = 0;
  if (Array.isArray(responsibilities)) {
    responsibilities.forEach((item) => {
      sum += item.hours || 0;
    });
  }
  return sum;
}

/**
 * Computes status and totals for a faculty record.
 * Status values: 'MATCHED' | 'REVIEW REQUIRED' | 'INCOMPLETE SOURCE DATA'
 */
export function processWorkloadRecord(rawRecord) {
  const teachingHours = calculateTeachingHours(rawRecord.teaching);
  const responsibilityHours = calculateResponsibilityHours(rawRecord.responsibilities);
  const calculatedTotalHours = teachingHours + responsibilityHours;

  let status = 'MATCHED';
  let discrepancyNote = null;

  if (rawRecord.isIncomplete || rawRecord.sourceTotalHours === null || rawRecord.sourceTotalHours === undefined) {
    status = 'INCOMPLETE SOURCE DATA';
    discrepancyNote = rawRecord.incompleteReason || 'Source total hours not provided or legible.';
  } else if (rawRecord.sourceTotalHours !== calculatedTotalHours) {
    status = 'REVIEW REQUIRED';
    discrepancyNote = `Source total (${rawRecord.sourceTotalHours}h) does not match calculated total (${calculatedTotalHours}h). Difference: ${Math.abs(
      rawRecord.sourceTotalHours - calculatedTotalHours
    )}h.`;
  }

  return {
    ...rawRecord,
    teachingHours,
    responsibilityHours,
    calculatedTeachingHours: teachingHours,
    calculatedResponsibilityHours: responsibilityHours,
    calculatedTotalHours: rawRecord.sourceTotalHours !== null ? calculatedTotalHours : calculatedTotalHours,
    status,
    discrepancyNote,
  };
}

/**
 * Returns processed workload records with computed totals and status.
 */
export function getWorkloadMaster() {
  return FACULTY_WORKLOAD_MASTER.map(processWorkloadRecord);
}

/**
 * Retrieves a single faculty workload record by ID.
 */
export function getFacultyWorkloadById(facultyId) {
  const record = FACULTY_WORKLOAD_MASTER.find((f) => f.facultyId === facultyId);
  return record ? processWorkloadRecord(record) : null;
}

/**
 * Computes overall dashboard metrics.
 */
export function getWorkloadSummaryMetrics() {
  const list = getWorkloadMaster();

  let totalTeachingHours = 0;
  let totalResponsibilityHours = 0;
  let totalAllocatedHours = 0;
  let completeCount = 0;
  let incompleteCount = 0;
  let discrepancyCount = 0;

  list.forEach((f) => {
    totalTeachingHours += f.teachingHours;
    totalResponsibilityHours += f.responsibilityHours;
    totalAllocatedHours += f.calculatedTotalHours;

    if (f.status === 'INCOMPLETE SOURCE DATA') {
      incompleteCount++;
    } else if (f.status === 'REVIEW REQUIRED') {
      discrepancyCount++;
    } else {
      completeCount++;
    }
  });

  return {
    totalFaculty: list.length,
    totalTeachingHours,
    totalResponsibilityHours,
    totalAllocatedHours,
    completeCount,
    incompleteCount,
    discrepancyCount,
  };
}

/**
 * Validates a workload record against integrity rules.
 */
export function validateWorkloadRecord(record) {
  const errors = [];

  if (!record.facultyName || !record.facultyName.trim()) {
    errors.push('Missing faculty name.');
  }

  if (!record.designation || !record.designation.trim()) {
    errors.push('Missing designation.');
  }

  // Check teaching items
  Object.entries(record.teaching || {}).forEach(([catKey, items]) => {
    items.forEach((item, idx) => {
      if (item.hours < 0) {
        errors.push(`Negative hours found in ${catKey} item ${idx + 1}: ${item.hours}`);
      }
      if (!item.courseName || !item.courseName.trim()) {
        errors.push(`Missing course title in ${catKey} item ${idx + 1}`);
      }
    });
  });

  // Check responsibility items
  (record.responsibilities || []).forEach((resp, idx) => {
    if (resp.hours < 0) {
      errors.push(`Negative hours in responsibility item ${idx + 1}: ${resp.hours}`);
    }
    if (!resp.role || !resp.role.trim()) {
      errors.push(`Missing role title in responsibility item ${idx + 1}`);
    }
  });

  if (record.sourceTotalHours === null || record.isIncomplete) {
    errors.push(`Incomplete source record: ${record.incompleteReason || 'Total hours unspecified.'}`);
  } else if (record.calculatedTotalHours !== record.sourceTotalHours) {
    errors.push(
      `Source total mismatch: source indicates ${record.sourceTotalHours}h, but calculated sum is ${record.calculatedTotalHours}h.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Dynamic search and filter utility across the master workload register.
 */
export function searchAndFilterWorkload({
  searchQuery = '',
  roleFilter = 'all',
  categoryFilter = 'all',
  statusFilter = 'all',
} = {}) {
  const list = getWorkloadMaster();
  const q = searchQuery.toLowerCase().trim();

  return list.filter((faculty) => {
    // 1. Text Search across name, designation, course code, course name, allocation context, and responsibilities
    if (q) {
      const matchName = faculty.facultyName.toLowerCase().includes(q);
      const matchDesig = faculty.designation.toLowerCase().includes(q);

      let matchCourse = false;
      Object.values(faculty.teaching).forEach((items) => {
        items.forEach((item) => {
          if (
            (item.courseCode && item.courseCode.toLowerCase().includes(q)) ||
            (item.courseName && item.courseName.toLowerCase().includes(q)) ||
            (item.allocation && item.allocation.toLowerCase().includes(q))
          ) {
            matchCourse = true;
          }
        });
      });

      let matchResp = false;
      faculty.responsibilities.forEach((resp) => {
        if (
          (resp.role && resp.role.toLowerCase().includes(q)) ||
          (resp.allocation && resp.allocation.toLowerCase().includes(q))
        ) {
          matchResp = true;
        }
      });

      if (!matchName && !matchDesig && !matchCourse && !matchResp) {
        return false;
      }
    }

    // 2. Status Filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'MATCHED' && faculty.status !== 'MATCHED') return false;
      if (statusFilter === 'REVIEW REQUIRED' && faculty.status !== 'REVIEW REQUIRED') return false;
      if (statusFilter === 'INCOMPLETE SOURCE DATA' && faculty.status !== 'INCOMPLETE SOURCE DATA') return false;
    }

    // 3. Role / Responsibility Filter
    if (roleFilter !== 'all') {
      if (roleFilter === 'HOD') {
        const isHOD =
          faculty.designation.toLowerCase().includes('hod') ||
          faculty.responsibilities.some((r) => r.role.toLowerCase().includes('hod'));
        if (!isHOD) return false;
      } else if (roleFilter === 'ACADEMIC_COORDINATOR') {
        const isAC = faculty.responsibilities.some((r) =>
          r.role.toLowerCase().includes('academic coordinator')
        );
        if (!isAC) return false;
      } else if (roleFilter === 'CLASS_ADVISOR') {
        const isCA = faculty.responsibilities.some((r) =>
          r.role.toLowerCase().includes('class advisor')
        );
        if (!isCA) return false;
      } else if (roleFilter === 'PROCTOR') {
        const isProctor = faculty.responsibilities.some((r) =>
          r.role.toLowerCase().includes('proctor')
        );
        if (!isProctor) return false;
      } else if (roleFilter === 'TEACHING_ONLY') {
        if (faculty.responsibilities.length > 0) return false;
      } else if (roleFilter === 'RESPONSIBILITIES') {
        if (faculty.responsibilities.length === 0) return false;
      }
    }

    // 4. Teaching Category Filter
    if (categoryFilter !== 'all') {
      if (categoryFilter === 'UG_THEORY') {
        const hasUGT =
          faculty.teaching.ugTheory1.length > 0 || faculty.teaching.ugTheory2.length > 0;
        if (!hasUGT) return false;
      } else if (categoryFilter === 'LAB') {
        const hasLab = faculty.teaching.lab1.length > 0 || faculty.teaching.lab2.length > 0;
        if (!hasLab) return false;
      } else if (categoryFilter === 'PG') {
        if (faculty.teaching.pg.length === 0) return false;
      } else if (categoryFilter === 'OTHERS') {
        if (faculty.teaching.others.length === 0) return false;
      }
    }

    return true;
  });
}

export const FACULTY_WORKLOAD_SOURCE = FACULTY_WORKLOAD_MASTER;

/**
 * Authoritative CSE Faculty Directory for HOD Workflows.
 * Derived from FACULTY_WORKLOAD_MASTER (27 Faculty: 25 CSE, 2 ECE).
 * Excludes non-CSE faculty:
 * - Dr. R. Praveenkumar — ASP / ECE (FWL-26)
 * - Ms. B. Preethi — AP / ECE (FWL-27)
 *
 * Preserves exact source values: facultyId, facultyName, designation.
 * Exposes calculated workload totals: calculatedTeachingHours, calculatedResponsibilityHours, calculatedTotalHours, status.
 * Leaves raw FACULTY_WORKLOAD_MASTER completely untouched.
 */
export function getCSEFacultyFromWorkload() {
  const NON_CSE_IDS = new Set(['FWL-26', 'FWL-27']);
  const NON_CSE_DESIGNATIONS = ['ASP / ECE', 'AP / ECE'];

  return getWorkloadMaster().filter((faculty) => {
    if (NON_CSE_IDS.has(faculty.facultyId)) return false;
    if (NON_CSE_DESIGNATIONS.includes(faculty.designation)) return false;
    return true;
  });
}

