import {
  User,
  Course,
  CourseWeek,
  Lecture,
  StudentLectureState,
  BadgePolicy,
  Certificate,
  ActivityLog,
  WhatsAppNotificationLog
} from '../types';

export const INITIAL_BADGE_POLICY: BadgePolicy = {
  type: 'fixed_ranks',
  goldThreshold: 3,
  silverThreshold: 10,
  bronzeThreshold: 30
};

export const INITIAL_USERS: User[] = [
  {
    id: 'usr_doc_1',
    academicId: 'DOC-101',
    username: 'doctor',
    name: 'د. عبد الرحمن هاني',
    email: 'abdelrhman.hany@academy.edu',
    phone: '+201012345678',
    role: 'doctor',
    department: 'علوم الحاسب والذكاء الاصطناعي',
    password: '123456',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    joinedDate: '2023-09-01',
    status: 'active',
    lastLogin: 'الآن',
    notes: 'أستاذ المادة والمشرف الأكاديمي العام',
  },
  {
    id: 'usr_std_1',
    academicId: 'STD-2024-001',
    username: 'ahmed_ali',
    name: 'أحمد علي حسن',
    email: 'ahmed.ali@student.academy.edu',
    phone: '+201123456789',
    role: 'student',
    department: 'علوم الحاسب',
    password: '123456',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    joinedDate: '2024-09-10',
    status: 'active',
    lastLogin: 'منذ 10 دقائق',
    notes: 'طالب متميز - المركز الأول بالدفعة.',
  },
  {
    id: 'usr_std_2',
    academicId: 'STD-2024-002',
    username: 'sara_mohamed',
    name: 'سارة محمد إبراهيم',
    email: 'sara.mohamed@student.academy.edu',
    phone: '+201234567890',
    role: 'student',
    department: 'هندسة البرمجيات',
    password: '123456',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    joinedDate: '2024-09-12',
    status: 'active',
    lastLogin: 'منذ 25 دقيقة',
    notes: 'أداء ممتاز ومواظبة في تسليم الكويزات.',
  },
  {
    id: 'usr_std_3',
    academicId: 'STD-2024-003',
    username: 'youssef_khalid',
    name: 'يوسف خالد محمود',
    email: 'youssef.khalid@student.academy.edu',
    phone: '+201098765432',
    role: 'student',
    department: 'الذكاء الاصطناعي',
    password: '123456',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    joinedDate: '2024-09-15',
    status: 'active',
    lastLogin: 'اليوم، 01:15 م',
    notes: 'مستوى متصاعد وسرعة في حل المسائل البرمجية.',
  },
  {
    id: 'usr_std_4',
    academicId: 'STD-2024-004',
    username: 'nour_hassan',
    name: 'نور حسن مصطفى',
    email: 'nour.hassan@student.academy.edu',
    phone: '+201511223344',
    role: 'student',
    department: 'نظم المعلومات',
    password: '123456',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    joinedDate: '2024-09-20',
    status: 'active',
    lastLogin: 'اليوم، 11:30 ص',
    notes: 'مشاركة فعالة وملاحظات قيمة في التقييمات.',
  },
  {
    id: 'usr_std_5',
    academicId: 'STD-2024-005',
    username: 'omar_farouk',
    name: 'عمر فاروق الشناوي',
    email: 'omar.farouk@student.academy.edu',
    phone: '+201022334455',
    role: 'student',
    department: 'علوم الحاسب',
    password: '123456',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    joinedDate: '2024-09-18',
    status: 'active',
    lastLogin: 'أمس، 08:20 م',
  },
  {
    id: 'usr_std_6',
    academicId: 'STD-2024-006',
    username: 'mariam_adel',
    name: 'مريم عادل القاضي',
    email: 'mariam.adel@student.academy.edu',
    phone: '+201133445566',
    role: 'student',
    department: 'هندسة البرمجيات',
    password: '123456',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    joinedDate: '2024-09-21',
    status: 'active',
    lastLogin: 'اليوم، 09:40 ص',
  },
  {
    id: 'usr_std_7',
    academicId: 'STD-2024-007',
    username: 'khaled_tarek',
    name: 'خالد طارق عبد الله',
    email: 'khaled.tarek@student.academy.edu',
    phone: '+201244556677',
    role: 'student',
    department: 'علوم الحاسب',
    password: '123456',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
    joinedDate: '2024-09-22',
    status: 'active',
    lastLogin: 'أمس، 04:15 م',
  },
  {
    id: 'usr_std_8',
    academicId: 'STD-2024-008',
    username: 'fatma_saeed',
    name: 'فاطمة سعيد البشري',
    email: 'fatma.saeed@student.academy.edu',
    phone: '+201555667788',
    role: 'student',
    department: 'الذكاء الاصطناعي',
    password: '123456',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    joinedDate: '2024-09-25',
    status: 'active',
    lastLogin: 'منذ 3 ساعات',
  },
  {
    id: 'usr_std_9',
    academicId: 'STD-2024-009',
    username: 'mahmoud_hamdy',
    name: 'محمود حمدي المنشاوي',
    email: 'mahmoud.hamdy@student.academy.edu',
    phone: '+201066778899',
    role: 'student',
    department: 'علوم الحاسب',
    password: '123456',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
    joinedDate: '2024-09-26',
    status: 'active',
    lastLogin: 'منذ يومين',
  },
  {
    id: 'usr_std_10',
    academicId: 'STD-2024-010',
    username: 'salma_gamal',
    name: 'سلمى جمال النجار',
    email: 'salma.gamal@student.academy.edu',
    phone: '+201177889900',
    role: 'student',
    department: 'نظم المعلومات',
    password: '123456',
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80',
    joinedDate: '2024-09-28',
    status: 'active',
    lastLogin: 'أمس، 10:00 ص',
  },
  // Student 11: Outside top 10 to demonstrate student privacy (Sees Top 10 by name, and only their own rank #11)
  {
    id: 'usr_std_11',
    academicId: 'STD-2024-011',
    username: 'hassan_ali',
    name: 'حسن علي مكي',
    email: 'hassan.ali@student.academy.edu',
    phone: '+201288990011',
    role: 'student',
    department: 'هندسة البرمجيات',
    password: '123456',
    avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80',
    joinedDate: '2024-10-01',
    status: 'active',
    lastLogin: 'منذ ساعتين',
    notes: 'طالب في المركز 11 (خارج التوب 10 لاختبار الخصوصية).',
  },
  // Student 12: Has Alarm 1 (Absence in 2 consecutive lectures)
  {
    id: 'usr_std_12',
    academicId: 'STD-2024-012',
    username: 'mona_fathy',
    name: 'منى فتحي السويفي',
    email: 'mona.fathy@student.academy.edu',
    phone: '+201099001122',
    role: 'student',
    department: 'علوم الحاسب',
    password: '123456',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    joinedDate: '2024-10-02',
    status: 'active',
    lastLogin: 'منذ 5 أيام',
    notes: '⚠️ إنذار غياب: تغيبت عن آخر محاضرتين متتاليتين.',
  },
  // Student 13: Has Alarm 2 (Performance drop >= 20% compared to average of last 3 quizzes)
  {
    id: 'usr_std_13',
    academicId: 'STD-2024-013',
    username: 'amr_ezzat',
    name: 'عمرو عزت الجندي',
    email: 'amr.ezzat@student.academy.edu',
    phone: '+201500112233',
    role: 'student',
    department: 'الذكاء الاصطناعي',
    password: '123456',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
    joinedDate: '2024-10-03',
    status: 'active',
    lastLogin: 'اليوم، 03:00 م',
    notes: '📉 إنذار هبوط أداء: هبطت درجته بنسبة 35% في آخر كويز.',
  }
];

export const INITIAL_COURSES: Course[] = [
  {
    id: 'crs_ds_301',
    title: 'هياكل البيانات والخوارزميات المتقدمة',
    code: 'CS-301',
    doctorName: 'د. عبد الرحمن هاني',
    doctorId: 'usr_doc_1',
    department: 'علوم الحاسب والذكاء الاصطناعي',
    description: 'مقرر شامل يغطي أسس تحليل التعقيد الحسابي، القوائم المترابطة، المكدسات، الأشجار الثنائية وخوارزميات الرسوم البيانية مع تطبيقات عملية.',
    color: 'from-indigo-600 to-blue-600',
    weeks: [
      {
        id: 'week_1',
        courseId: 'crs_ds_301',
        weekNumber: 1,
        title: 'الأسبوع الأول: أسس كفاءة الخوارزميات (Big-O) والمصفوفات',
        description: 'مفهوم التعقيد الزمني والمكاني ومقارنة أداء الخوارزميات وتحسين استهلاك الذاكرة.',
        lectures: [
          {
            id: 'lec_1_1',
            weekId: 'week_1',
            courseId: 'crs_ds_301',
            title: 'المحاضرة 1: تحليل كفاءة الخوارزميات (Asymptotic Analysis & Big-O)',
            order: 1,
            releaseAt: '2024-10-01T08:00:00Z',
            duration: '45 دقيقة',
            summary: 'شرح مفهوم معدل النمو الرياضي، المقارنة بين O(1) و O(n) و O(log n) و O(n^2)، وطرق تحليل الحلقات المتداخلة.',
            videoUrl: 'https://www.youtube-nocookie.com/embed/8hly31xKli0',
            explanationPdf: {
              title: 'سلايدات_المحاضرة_1_تحليل_الكفاءة.pdf',
              url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
              pageCount: 4,
              topics: ['مقدمة للـ Big-O', 'دوال النمو الشهيرة', 'التعقيد المكاني Space Complexity', 'أمثلة عملية وحسابات'],
              pages: [
                {
                  pageNumber: 1,
                  title: 'مقدمة في التحليل التقاربي (Asymptotic Analysis)',
                  content: 'الهدف من تحليل الخوارزميات ليس قياس الوقت الفعلي بالثواني (لأنه يعتمد على مواصفات المعالج ونظام التشغيل ولغة البرمجة)، بل قياس معدل نمو عدد العمليات الحسابية بدلالة حجم المدخلات N.\n\nالرموز الأساسية:\n1. Big-O: يمثل الحد الأقصى أو أسوأ سيناريو للأداء (Upper Bound).\n2. Omega (Ω): يمثل الحد الأدنى أو أفضل سيناريو (Lower Bound).\n3. Theta (θ): يمثل الحد المحكم الضيق (Tight Bound).',
                  diagramType: 'summary'
                },
                {
                  pageNumber: 2,
                  title: 'دوال التعقيد الشائعة وترتيب سرعتها',
                  content: 'ترتيب كفاءة الدوال من الأسرع إلى الأبطأ:\n• O(1) - Constant Time: زمن ثابت لا يتأثر بحجم المدخلات (مثال: الوصول لعنصر في مصفوفة بالـ Index).\n• O(log n) - Logarithmic Time: ممتاز جداً، يقسم المشكلة لنصفين في كل خطوة (مثال: Binary Search).\n• O(n) - Linear Time: يتناسب طردياً مع حجم المدخلات (مثال: Linear Search).\n• O(n log n) - Linearithmic Time: كفاءة خوارزميات الترتيب المتقدمة (Merge Sort, Quick Sort).\n• O(n^2) - Quadratic Time: خوارزميات الحلقات المتداخلة البسيطة (Bubble Sort).\n• O(2^n) - Exponential Time: خوارزميات التكرار الأسي غير الفعالة.',
                  diagramType: 'table'
                },
                {
                  pageNumber: 3,
                  title: 'التعقيد المكاني (Space Complexity) والمفاضلة',
                  content: 'التعقيد المكاني يقيس حجم الذاكرة الإضافية (Auxiliary Space) التي تتطلبها الخوارزمية أثناء التنفيذ:\n\nقاعدة هامة في هندسة البرمجيات:\nغالباً ما نواجه مفاضلة (Trade-off) بين الوقت والمساحة (Time-Space Trade-off). استخدام جدول تجزئة (Hash Table) يمنحنا بحثاً بزمن O(1) ولكن على حساب استهلاك ذاكرة إضافية O(n).',
                  diagramType: 'flowchart'
                },
                {
                  pageNumber: 4,
                  title: 'أمثلة تطبيقية وتمارين مراجعة',
                  content: 'تطبيق عملي لحساب Big-O:\n1. إذا كانت الحلقة تدور من 1 إلى N وتقفز بمضاعفة i *= 2، فالتعقيد هو O(log n).\n2. إذا كان لدينا حلقتان متداخلتان كل واحدة تدور N مرة، فالتعقيد O(n^2).\n3. استدعاء الدالة العودية (Recursive) يستهلك ذاكرة في مكدس النداءات (Call Stack) بحجم يساوي عمق شجرة الاستدعاء.',
                  diagramType: 'code'
                }
              ]
            },
            questionBank: [
              {
                id: 'qb_1_1',
                lectureId: 'lec_1_1',
                questionNumber: 1,
                type: 'multiple_choice',
                prompt: 'ما هو التعقيد الزمني (Time Complexity) للوصول إلى عنصر في مصفوفة عادية عن طريق الفهرس (Index)؟',
                options: ['أ) O(1)', 'ب) O(n)', 'ج) O(log n)', 'د) O(n^2)'],
                correctOptionIndex: 0,
                correctAnswerText: 'أ',
                explanation: 'مصفوفات الذاكرة تسمح بالوصول المباشر O(1) بفضل الحساب المباشر لعنوان الخلية في الرام.',
                points: 1
              },
              {
                id: 'qb_1_2',
                lectureId: 'lec_1_1',
                questionNumber: 2,
                type: 'true_false',
                prompt: 'خوارزمية البحث الثنائي (Binary Search) تتطلب أن تكون المصفوفة مرتبة مسبقاً لتعمل بكفاءة O(log n).',
                options: ['أ) صح', 'ب) خطأ'],
                correctOptionIndex: 0,
                correctAnswerText: 'صح',
                explanation: 'البحث الثنائي يعتمد على تقسيم المجال لنصفين، وهو ما لا يمكن إلا على بيانات مرتبة.',
                points: 1
              },
              {
                id: 'qb_1_3',
                lectureId: 'lec_1_1',
                questionNumber: 3,
                type: 'multiple_choice',
                prompt: 'إذا احتوت دالة على حلقتين متداخلتين (Nested Loops) وكل حلقة تدور N مرة، فما هو التعقيد الزمني للدالة؟',
                options: ['أ) O(n)', 'ب) O(n log n)', 'ج) O(n^2)', 'د) O(2^n)'],
                correctOptionIndex: 2,
                correctAnswerText: 'ج',
                explanation: 'الحلقة الخارجية N والداخلية N، حاصل الضرب N * N = O(n^2).',
                points: 1
              },
              {
                id: 'qb_1_4',
                lectureId: 'lec_1_1',
                questionNumber: 4,
                type: 'multiple_choice',
                prompt: 'أي رمز رياضي يُستخدم للتعبير عن الحد الأسوأ المطلق (Upper Bound) لأداء الخوارزمية؟',
                options: ['أ) Big-Omega (Ω)', 'ب) Big-O (O)', 'ج) Big-Theta (θ)', 'د) Little-o'],
                correctOptionIndex: 1,
                correctAnswerText: 'ب',
                explanation: 'رمز Big-O هو المعيار الأكاديمي لتمثيل أسوأ سيناريو أداء.',
                points: 1
              },
              {
                id: 'qb_1_5',
                lectureId: 'lec_1_1',
                questionNumber: 5,
                type: 'essay',
                prompt: 'وضح بإيجاز ما هي المفاضلة بين الوقت والذاكرة (Time-Space Trade-off) مع ذكر مثال من واقع بنى البيانات.',
                options: [],
                explanation: 'سؤال مقالي يُصحح بناءً على فهم الطالب لمفهوم التضحية بالذاكرة لكسب سرعة التنفيذ كاستخدام التجزئة أو الـ Memoization.',
                points: 1
              }
            ],
            quizSettings: {
              validityWindowHours: 24,
              durationMinutes: 15,
              randomizeQuestions: true,
              randomizeChoices: true,
              preventGoBack: false,
              questionsToDraw: 4,
              passingPercentage: 60
            }
          },
          {
            id: 'lec_1_2',
            weekId: 'week_1',
            courseId: 'crs_ds_301',
            title: 'المحاضرة 2: المكدس والطابور (Stacks & Queues)',
            order: 2,
            releaseAt: '2024-10-03T08:00:00Z',
            duration: '50 دقيقة',
            summary: 'مفاهيم LIFO و FIFO وتطبيقاتها الحيوية في مكدس استدعاء الدوال والتراجع (Undo) وجدولة المهام.',
            videoUrl: 'https://www.youtube-nocookie.com/embed/8hly31xKli0',
            explanationPdf: {
              title: 'سلايدات_المحاضرة_2_المكدس_والطابور.pdf',
              url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
              pageCount: 3,
              topics: ['بنية المكدس Stack (LIFO)', 'بنية الطابور Queue (FIFO)', 'التطبيقات العملية والأخطاء الشائعة'],
              pages: [
                {
                  pageNumber: 1,
                  title: 'المكدس Stack ومبدأ LIFO',
                  content: 'المكدس هو بنية بيانات خطية تتبع مبدأ Last In First Out (العنصر الأخير الذي يدخل هو أول من يخرج).\n\nالعمليات الأساسية:\n1. Push(x): إضافة عنصر في القمة O(1).\n2. Pop(): سحب العنصر من القمة O(1).\n3. Peek(): معاينة العنصر في القمة دون حذفه O(1).\n4. isEmpty(): التحقق من الفراغ.',
                  diagramType: 'summary'
                },
                {
                  pageNumber: 2,
                  title: 'الطابور Queue ومبدأ FIFO',
                  content: 'الطابور يتبع مبدأ First In First Out (أول داخل أول خارج).\n\nالعمليات الأساسية:\n1. Enqueue(x): إضافة في نهاية الطابور O(1).\n2. Dequeue(): سحب من بداية الطابور O(1).\n3. Front(): رؤية العنصر الأول.\n\nتطبيقات:\n• طوابير الطباعة (Print Spoolers).\n• خوارزمية BFS في الرسوم البيانية.',
                  diagramType: 'flowchart'
                },
                {
                  pageNumber: 3,
                  title: 'تطبيقات برمجية شهيرة للمكدس',
                  content: 'أين نستخدم الـ Stack؟\n1. تقييم التعبيرات الحسابية وتطابق الأقواس (Balanced Parentheses).\n2. ميزة التراجع (Undo / Redo) في برامج التحرير.\n3. سجل المتصفح (Browser Back/Forward Button).\n4. Call Stack الداخلي في لغات البرمجة لاستدعاء الدوال.',
                  diagramType: 'table'
                }
              ]
            },
            questionBank: [
              {
                id: 'qb_2_1',
                lectureId: 'lec_1_2',
                questionNumber: 1,
                type: 'true_false',
                prompt: 'المكدس (Stack) يعمل وفق مبدأ FIFO (First In First Out).',
                options: ['أ) صح', 'ب) خطأ'],
                correctOptionIndex: 1,
                correctAnswerText: 'خطأ',
                explanation: 'المكدس يعمل وفق مبدأ LIFO بينما الطابور Queue هو الذي يعمل وفق مبدأ FIFO.',
                points: 1
              },
              {
                id: 'qb_2_2',
                lectureId: 'lec_1_2',
                questionNumber: 2,
                type: 'multiple_choice',
                prompt: 'ما هي العملية المستخدمة لإضافة عنصر جديد إلى أعلى المكدس (Stack)؟',
                options: ['أ) Pop', 'ب) Dequeue', 'ج) Push', 'د) Enqueue'],
                correctOptionIndex: 2,
                correctAnswerText: 'ج',
                explanation: 'عملية Push تضع العنصر في القمة بزمن O(1).',
                points: 1
              },
              {
                id: 'qb_2_3',
                lectureId: 'lec_1_2',
                questionNumber: 3,
                type: 'multiple_choice',
                prompt: 'أي بنية بيانات تستخدمها خوارزمية البحث في العرض أولاً (BFS) لحفظ المسارات؟',
                options: ['أ) المكدس (Stack)', 'ب) الطابور (Queue)', 'ج) شجرة البحث (BST)', 'د) مصفوفة ثابتة'],
                correctOptionIndex: 1,
                correctAnswerText: 'ب',
                explanation: 'خوارزمية BFS تحتاج طابور Queue لمعالجة الرؤوس مستوى بمستوى.',
                points: 1
              },
              {
                id: 'qb_2_4',
                lectureId: 'lec_1_2',
                questionNumber: 4,
                type: 'essay',
                prompt: 'اشرح كيف يستخدم المترجم (Compiler) المكدس في فحص توازن الأقواس في الشفرة البرمجية.',
                options: [],
                explanation: 'سؤال مقالي: يتم دفع كل قوس مفتوح بالـ Push، وعند مصادفة قوس مغلق يتم الـ Pop والتأكد من التطابق.',
                points: 1
              }
            ],
            quizSettings: {
              validityWindowHours: 24,
              durationMinutes: 15,
              randomizeQuestions: true,
              randomizeChoices: true,
              preventGoBack: true,
              questionsToDraw: 3,
              passingPercentage: 60
            }
          }
        ]
      },
      {
        id: 'week_2',
        courseId: 'crs_ds_301',
        weekNumber: 2,
        title: 'الأسبوع الثاني: القوائم المترابطة (Linked Lists)',
        description: 'بناء وإدارة القوائم الفردية والمزدوجة والعمليات على المؤشرات والمقارنة مع المصفوفات.',
        lectures: [
          {
            id: 'lec_2_1',
            weekId: 'week_2',
            courseId: 'crs_ds_301',
            title: 'المحاضرة 3: القوائم المترابطة الفردية والدائرية (Singly & Circular Linked Lists)',
            order: 3,
            releaseAt: '2024-10-08T08:00:00Z',
            duration: '55 دقيقة',
            summary: 'إدارة العقد (Nodes) ومؤشرات Next وتخصيص الذاكرة الديناميكي وسرعة الإدراج والحذف.',
            videoUrl: 'https://www.youtube-nocookie.com/embed/8hly31xKli0',
            explanationPdf: {
              title: 'سلايدات_المحاضرة_3_القوائم_المترابطة.pdf',
              url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
              pageCount: 3,
              topics: ['مفهوم العقدة Node', 'الإدراج في البداية والنهاية', 'المقارنة بين Array و Linked List'],
              pages: [
                {
                  pageNumber: 1,
                  title: 'تشريح القائمة المترابطة الفردية',
                  content: 'تتكون القائمة المترابطة من عقد (Nodes)، كل عقدة تحتوي:\n1. حقل البيانات (Data).\n2. مؤشر للعقدة التالية (Next Pointer).\n\nالعقدة الأولى تسمى الرأس (Head)، والعقدة الأخيرة تشير إلى Null.',
                  diagramType: 'flowchart'
                },
                {
                  pageNumber: 2,
                  title: 'العمليات وسرعتها في القوائم المترابطة',
                  content: 'مقارنة السرعة مع المصفوفات:\n• الإدراج في البداية: O(1) في القائمة المترابطة مقابل O(n) في المصفوفة.\n• الوصول لعنصر بفهرسه: O(n) في القائمة المترابطة مقابل O(1) في المصفوفة.\n• الحجم الديناميكي: القائمة تنمو وتقل حسب الحاجة دون حجز ذاكرة مسبقة.',
                  diagramType: 'table'
                },
                {
                  pageNumber: 3,
                  title: 'القوائم الدائرية والمزدوجة',
                  content: 'في القائمة المترابطة الدائرية (Circular Linked List)، العقدة الأخيرة تشير عائدة إلى العقدة الأولى Head بدلاً من Null، وتستخدم في جدولة معالجات Round Robin وتدوير الوسائط.',
                  diagramType: 'summary'
                }
              ]
            },
            questionBank: [
              {
                id: 'qb_3_1',
                lectureId: 'lec_2_1',
                questionNumber: 1,
                type: 'multiple_choice',
                prompt: 'ما هو التعقيد الزمني لإدراج عنصر جديد في بداية القائمة المترابطة (Insert at Head)؟',
                options: ['أ) O(1)', 'ب) O(n)', 'ج) O(log n)', 'د) O(n^2)'],
                correctOptionIndex: 0,
                correctAnswerText: 'أ',
                explanation: 'يكفي إنشاء عقدة جديدة وجعل مؤشرها يشير للـ Head الحالي وتحديث Head، في خطوة واحدة O(1).',
                points: 1
              },
              {
                id: 'qb_3_2',
                lectureId: 'lec_2_1',
                questionNumber: 2,
                type: 'true_false',
                prompt: 'في القائمة المترابطة الدائرية، تشير العقدة الأخيرة إلى Null كما في القوائم العادية.',
                options: ['أ) صح', 'ب) خطأ'],
                correctOptionIndex: 1,
                correctAnswerText: 'خطأ',
                explanation: 'في القائمة الدائرية تشير العقدة الأخيرة إلى الرأس Head مجدداً.',
                points: 1
              },
              {
                id: 'qb_3_3',
                lectureId: 'lec_2_1',
                questionNumber: 3,
                type: 'multiple_choice',
                prompt: 'ما العيب الرئيسي للقوائم المترابطة مقارنة بالمصفوفات في استخدام الذاكرة؟',
                options: [
                  'أ) لا يمكن تخزين أعداد صحيحة بها',
                  'ب) تحتاج ذاكرة إضافية لتخزين المؤشرات (Pointers) في كل عقدة',
                  'ج) لا تدعم الحذف',
                  'د) حجمها ثابت دائماً'
                ],
                correctOptionIndex: 1,
                correctAnswerText: 'ب',
                explanation: 'كل عقدة تحتوي على مؤشر Next إضافي بجانب البيانات مما يرفع استهلاك الذاكرة الإجمالي.',
                points: 1
              }
            ],
            quizSettings: {
              validityWindowHours: 24,
              durationMinutes: 12,
              randomizeQuestions: true,
              randomizeChoices: true,
              preventGoBack: false,
              questionsToDraw: 3,
              passingPercentage: 60
            }
          }
        ]
      },
      {
        id: 'week_3',
        courseId: 'crs_ds_301',
        weekNumber: 3,
        title: 'الأسبوع الثالث: الأشجار وخوارزميات البحث (Trees & BST)',
        description: 'الأشجار الثنائية، أشجار البحث الثنائية BST، وتوازن الأشجار AVL Trees.',
        lectures: [
          {
            id: 'lec_3_1',
            weekId: 'week_3',
            courseId: 'crs_ds_301',
            title: 'المحاضرة 4: أشجار البحث الثنائية والتوازن (Binary Search Trees & AVL)',
            order: 4,
            releaseAt: '2024-10-15T08:00:00Z',
            duration: '60 دقيقة',
            summary: 'خصائص الـ BST، عمليات البحث والإدراج، الحالات المنحدرة (Degenerate) وكيفية توازن AVL بالدوران.',
            videoUrl: 'https://www.youtube-nocookie.com/embed/8hly31xKli0',
            explanationPdf: {
              title: 'سلايدات_المحاضرة_4_أشجار_البحث.pdf',
              url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
              pageCount: 3,
              topics: ['قاعدة الـ BST', 'عمليات التصفح Inorder, Preorder, Postorder', 'أشجار AVL'],
              pages: [
                {
                  pageNumber: 1,
                  title: 'خاصية شجرة البحث الثنائية BST',
                  content: 'في أي عقدة داخل الـ BST:\n1. كل القيم في الفرع الأيسر (Left Subtree) أصغر تماماً من قيمة العقدة.\n2. كل القيم في الفرع الأيمن (Right Subtree) أكبر تماماً من قيمة العقدة.\n\nتصفح الشجرة بطريقة In-order يعطي العناصر مرتبة تصاعدياً دوماً!',
                  diagramType: 'tree'
                },
                {
                  pageNumber: 2,
                  title: 'كفاءة البحث والتحول إلى قائمة خطية',
                  content: 'إذا كانت الشجرة متوازنة:\n• البحث، الإدراج، الحذف: O(log n).\n\nإذا أدخلنا بيانات مرتبة تصاعدياً في شجرة عادية غير متوازنة، تتحول الشجرة إلى خط منحدر (Skewed/Degenerate Tree) ويهبط أداؤها إلى O(n) تماماً كالقائمة المترابطة!',
                  diagramType: 'table'
                },
                {
                  pageNumber: 3,
                  title: 'أشجار AVL وعمليات الدوران Rotations',
                  content: 'لحل مشكلة الانحدار، تحسب شجرة AVL عامل التوازن (Balance Factor = Height(Left) - Height(Right)).\nإذا تجاوز العامل +1 أو هبط دون -1، تقوم الشجرة بعمليات دوران (Left Rotation, Right Rotation, Left-Right, Right-Left) لتبقى متوازنة O(log n).',
                  diagramType: 'flowchart'
                }
              ]
            },
            questionBank: [
              {
                id: 'qb_4_1',
                lectureId: 'lec_3_1',
                questionNumber: 1,
                type: 'multiple_choice',
                prompt: 'شجرة البحث الثنائية المتوازنة (AVL Tree) تضمن أن وقت البحث لا يتجاوز:',
                options: ['أ) O(1)', 'ب) O(log n)', 'ج) O(n)', 'د) O(n log n)'],
                correctOptionIndex: 1,
                correctAnswerText: 'ب',
                explanation: 'بفضل إعادة التوازن المستمرة عبر الدوران، يظل الارتفاع مقيداً بـ log n دوماً.',
                points: 1
              },
              {
                id: 'qb_4_2',
                lectureId: 'lec_3_1',
                questionNumber: 2,
                type: 'true_false',
                prompt: 'تصفح شجرة البحث الثنائية بطريقة In-order ينتج دائماً عناصر مرتبة تصاعدياً.',
                options: ['أ) صح', 'ب) خطأ'],
                correctOptionIndex: 0,
                correctAnswerText: 'صح',
                explanation: 'In-order يزور: اليسار (الأصغر) -> الجذر -> اليمين (الأكبر)، وهو ترتيب تصاعدي.',
                points: 1
              },
              {
                id: 'qb_4_3',
                lectureId: 'lec_3_1',
                questionNumber: 3,
                type: 'multiple_choice',
                prompt: 'عامل التوازن المسموح به في أي عقدة لشجرة AVL يجب أن يكون بين:',
                options: ['أ) 0 فقط', 'ب) -1 و 0 و +1', 'ج) -2 و +2', 'د) أي قيمة'],
                correctOptionIndex: 1,
                correctAnswerText: 'ب',
                explanation: 'الشرط الرياضي لـ AVL هو أن يكون الفرق بين ارتفاع الشجرتين الفرعيتين ≤ 1.',
                points: 1
              }
            ],
            quizSettings: {
              validityWindowHours: 24,
              durationMinutes: 15,
              randomizeQuestions: true,
              randomizeChoices: true,
              preventGoBack: false,
              questionsToDraw: 3,
              passingPercentage: 60
            }
          }
        ]
      }
    ]
  }
];

// Helper to flatten lectures
export function getAllLectures(courses: Course[]): Lecture[] {
  return courses.flatMap(c => c.weeks.flatMap(w => w.lectures));
}

// Generate rich initial student lecture states to test all scenarios:
// - Ahmed Ali: Complete in all 4 lectures, high scores, high points
// - Sara Mohamed: Complete in 4 lectures, close second
// - Youssef Khalid: Complete in 4 lectures, third
// - Hassan Ali (std 11): Has solved quizzes, ranks #11 (outside top 10)
// - Mona Fathy (std 12): Attended lec 1, missed lec 2 and 3 => TRIGGER ALARM 1 (2 consecutive absences)
// - Amr Ezzat (std 13): Got 100% on lec 1, 90% on lec 2, 95% on lec 3, then got 25% on lec 4 => TRIGGER ALARM 2 (Performance drop >= 20%)
export const INITIAL_STUDENT_STATES: StudentLectureState[] = [
  // Ahmed Ali (STD-2024-001) - Top Student
  {
    id: 'state_1_1',
    studentId: 'usr_std_1',
    lectureId: 'lec_1_1',
    courseId: 'crs_ds_301',
    weekId: 'week_1',
    currentStage: 'completed',
    stage1Completed: true,
    stage1CompletedAt: '2024-10-01T09:15:00Z',
    stage2Completed: true,
    attended: true,
    attendanceSubmittedAt: '2024-10-01T09:20:00Z',
    starRating: 5,
    feedbackComment: 'شرح رائع وواضح جداً لرمز Big-O.',
    quizWindowStart: '2024-10-01T09:20:00Z',
    quizWindowEnd: '2024-10-02T09:20:00Z',
    quizCompleted: true,
    quizScore: 4,
    quizTotalPoints: 4,
    quizAttemptsCount: 1,
    quizStartedAt: '2024-10-01T09:25:00Z',
    quizFinishedAt: '2024-10-01T09:33:00Z',
    answers: {
      qb_1_1: { selectedOptionIndex: 0 },
      qb_1_2: { selectedOptionIndex: 0 },
      qb_1_3: { selectedOptionIndex: 2 },
      qb_1_4: { selectedOptionIndex: 1 }
    }
  },
  {
    id: 'state_1_2',
    studentId: 'usr_std_1',
    lectureId: 'lec_1_2',
    courseId: 'crs_ds_301',
    weekId: 'week_1',
    currentStage: 'completed',
    stage1Completed: true,
    stage1CompletedAt: '2024-10-03T10:00:00Z',
    stage2Completed: true,
    attended: true,
    attendanceSubmittedAt: '2024-10-03T10:10:00Z',
    starRating: 5,
    feedbackComment: 'فهمت المكدس والطابور وتطبيقات الـ Call stack.',
    quizWindowStart: '2024-10-03T10:10:00Z',
    quizWindowEnd: '2024-10-04T10:10:00Z',
    quizCompleted: true,
    quizScore: 3,
    quizTotalPoints: 3,
    quizAttemptsCount: 1,
    quizStartedAt: '2024-10-03T10:15:00Z',
    quizFinishedAt: '2024-10-03T10:22:00Z'
  },
  {
    id: 'state_1_3',
    studentId: 'usr_std_1',
    lectureId: 'lec_2_1',
    courseId: 'crs_ds_301',
    weekId: 'week_2',
    currentStage: 'completed',
    stage1Completed: true,
    stage1CompletedAt: '2024-10-08T11:00:00Z',
    stage2Completed: true,
    attended: true,
    attendanceSubmittedAt: '2024-10-08T11:15:00Z',
    starRating: 5,
    feedbackComment: 'مقارنة المصفوفة بالقوائم المترابطة كانت ممتازة.',
    quizWindowStart: '2024-10-08T11:15:00Z',
    quizWindowEnd: '2024-10-09T11:15:00Z',
    quizCompleted: true,
    quizScore: 3,
    quizTotalPoints: 3,
    quizAttemptsCount: 1,
    quizStartedAt: '2024-10-08T11:20:00Z',
    quizFinishedAt: '2024-10-08T11:28:00Z'
  },
  {
    id: 'state_1_4',
    studentId: 'usr_std_1',
    lectureId: 'lec_3_1',
    courseId: 'crs_ds_301',
    weekId: 'week_3',
    currentStage: 'completed',
    stage1Completed: true,
    stage1CompletedAt: '2024-10-15T09:00:00Z',
    stage2Completed: true,
    attended: true,
    attendanceSubmittedAt: '2024-10-15T09:12:00Z',
    starRating: 5,
    feedbackComment: 'أشجار AVL ودوران الشجرة تم شرحه ببراعة.',
    quizWindowStart: '2024-10-15T09:12:00Z',
    quizWindowEnd: '2024-10-16T09:12:00Z',
    quizCompleted: true,
    quizScore: 3,
    quizTotalPoints: 3,
    quizAttemptsCount: 1,
    quizStartedAt: '2024-10-15T09:15:00Z',
    quizFinishedAt: '2024-10-15T09:23:00Z'
  },

  // Sara Mohamed (STD-2024-002) - Rank 2
  {
    id: 'state_2_1',
    studentId: 'usr_std_2',
    lectureId: 'lec_1_1',
    courseId: 'crs_ds_301',
    weekId: 'week_1',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    attendanceSubmittedAt: '2024-10-01T10:00:00Z',
    starRating: 5,
    quizCompleted: true,
    quizScore: 4,
    quizTotalPoints: 4,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-01T10:20:00Z'
  },
  {
    id: 'state_2_2',
    studentId: 'usr_std_2',
    lectureId: 'lec_1_2',
    courseId: 'crs_ds_301',
    weekId: 'week_1',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    attendanceSubmittedAt: '2024-10-03T11:00:00Z',
    starRating: 5,
    quizCompleted: true,
    quizScore: 3,
    quizTotalPoints: 3,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-03T11:25:00Z'
  },
  {
    id: 'state_2_3',
    studentId: 'usr_std_2',
    lectureId: 'lec_2_1',
    courseId: 'crs_ds_301',
    weekId: 'week_2',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    attendanceSubmittedAt: '2024-10-08T12:00:00Z',
    starRating: 4,
    quizCompleted: true,
    quizScore: 3,
    quizTotalPoints: 3,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-08T12:30:00Z'
  },
  {
    id: 'state_2_4',
    studentId: 'usr_std_2',
    lectureId: 'lec_3_1',
    courseId: 'crs_ds_301',
    weekId: 'week_3',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    attendanceSubmittedAt: '2024-10-15T10:00:00Z',
    starRating: 5,
    quizCompleted: true,
    quizScore: 2, // 12 total points vs Ahmed 13
    quizTotalPoints: 3,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-15T10:25:00Z'
  },

  // Youssef Khalid (STD-2024-003) - Rank 3
  {
    id: 'state_3_1',
    studentId: 'usr_std_3',
    lectureId: 'lec_1_1',
    courseId: 'crs_ds_301',
    weekId: 'week_1',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 3,
    quizTotalPoints: 4,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-01T12:00:00Z'
  },
  {
    id: 'state_3_2',
    studentId: 'usr_std_3',
    lectureId: 'lec_1_2',
    courseId: 'crs_ds_301',
    weekId: 'week_1',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 3,
    quizTotalPoints: 3,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-03T13:00:00Z'
  },
  {
    id: 'state_3_3',
    studentId: 'usr_std_3',
    lectureId: 'lec_2_1',
    courseId: 'crs_ds_301',
    weekId: 'week_2',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 3,
    quizTotalPoints: 3,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-08T14:00:00Z'
  },
  {
    id: 'state_3_4',
    studentId: 'usr_std_3',
    lectureId: 'lec_3_1',
    courseId: 'crs_ds_301',
    weekId: 'week_3',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 2, // 11 total points
    quizTotalPoints: 3,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-15T12:00:00Z'
  },

  // Nour Hassan (STD-2024-004) - Rank 4
  {
    id: 'state_4_1',
    studentId: 'usr_std_4',
    lectureId: 'lec_1_1',
    courseId: 'crs_ds_301',
    weekId: 'week_1',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 3,
    quizTotalPoints: 4,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-01T15:00:00Z'
  },
  {
    id: 'state_4_2',
    studentId: 'usr_std_4',
    lectureId: 'lec_1_2',
    courseId: 'crs_ds_301',
    weekId: 'week_1',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 2,
    quizTotalPoints: 3,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-03T16:00:00Z'
  },
  {
    id: 'state_4_3',
    studentId: 'usr_std_4',
    lectureId: 'lec_2_1',
    courseId: 'crs_ds_301',
    weekId: 'week_2',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 3,
    quizTotalPoints: 3,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-08T16:00:00Z'
  },
  {
    id: 'state_4_4',
    studentId: 'usr_std_4',
    lectureId: 'lec_3_1',
    courseId: 'crs_ds_301',
    weekId: 'week_3',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 2, // 10 total points
    quizTotalPoints: 3,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-15T15:00:00Z'
  },

  // Omar Farouk (STD-2024-005) - Rank 5 (9 pts)
  {
    id: 'state_5_1',
    studentId: 'usr_std_5',
    lectureId: 'lec_1_1',
    courseId: 'crs_ds_301',
    weekId: 'week_1',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 3,
    quizTotalPoints: 4,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-01T17:00:00Z'
  },
  {
    id: 'state_5_2',
    studentId: 'usr_std_5',
    lectureId: 'lec_1_2',
    courseId: 'crs_ds_301',
    weekId: 'week_1',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 2,
    quizTotalPoints: 3,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-03T17:00:00Z'
  },
  {
    id: 'state_5_3',
    studentId: 'usr_std_5',
    lectureId: 'lec_2_1',
    courseId: 'crs_ds_301',
    weekId: 'week_2',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 2,
    quizTotalPoints: 3,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-08T17:00:00Z'
  },
  {
    id: 'state_5_4',
    studentId: 'usr_std_5',
    lectureId: 'lec_3_1',
    courseId: 'crs_ds_301',
    weekId: 'week_3',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 2,
    quizTotalPoints: 3,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-15T17:00:00Z'
  },

  // Mariam Adel (Rank 6 - 8 pts)
  {
    id: 'state_6_1',
    studentId: 'usr_std_6',
    lectureId: 'lec_1_1',
    courseId: 'crs_ds_301',
    weekId: 'week_1',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 2,
    quizTotalPoints: 4,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-01T18:00:00Z'
  },
  {
    id: 'state_6_2',
    studentId: 'usr_std_6',
    lectureId: 'lec_1_2',
    courseId: 'crs_ds_301',
    weekId: 'week_1',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 2,
    quizTotalPoints: 3,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-03T18:00:00Z'
  },
  {
    id: 'state_6_3',
    studentId: 'usr_std_6',
    lectureId: 'lec_2_1',
    courseId: 'crs_ds_301',
    weekId: 'week_2',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 2,
    quizTotalPoints: 3,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-08T18:00:00Z'
  },
  {
    id: 'state_6_4',
    studentId: 'usr_std_6',
    lectureId: 'lec_3_1',
    courseId: 'crs_ds_301',
    weekId: 'week_3',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 2,
    quizTotalPoints: 3,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-15T18:00:00Z'
  },

  // Khaled Tarek (Rank 7 - 7 pts)
  {
    id: 'state_7_1',
    studentId: 'usr_std_7',
    lectureId: 'lec_1_1',
    courseId: 'crs_ds_301',
    weekId: 'week_1',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 2,
    quizTotalPoints: 4,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-01T19:00:00Z'
  },
  {
    id: 'state_7_2',
    studentId: 'usr_std_7',
    lectureId: 'lec_1_2',
    courseId: 'crs_ds_301',
    weekId: 'week_1',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 2,
    quizTotalPoints: 3,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-03T19:00:00Z'
  },
  {
    id: 'state_7_3',
    studentId: 'usr_std_7',
    lectureId: 'lec_2_1',
    courseId: 'crs_ds_301',
    weekId: 'week_2',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 2,
    quizTotalPoints: 3,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-08T19:00:00Z'
  },
  {
    id: 'state_7_4',
    studentId: 'usr_std_7',
    lectureId: 'lec_3_1',
    courseId: 'crs_ds_301',
    weekId: 'week_3',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 1,
    quizTotalPoints: 3,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-15T19:00:00Z'
  },

  // Fatma Saeed (Rank 8 - 6 pts)
  {
    id: 'state_8_1',
    studentId: 'usr_std_8',
    lectureId: 'lec_1_1',
    courseId: 'crs_ds_301',
    weekId: 'week_1',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 2,
    quizTotalPoints: 4,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-01T20:00:00Z'
  },
  {
    id: 'state_8_2',
    studentId: 'usr_std_8',
    lectureId: 'lec_1_2',
    courseId: 'crs_ds_301',
    weekId: 'week_1',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 2,
    quizTotalPoints: 3,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-03T20:00:00Z'
  },
  {
    id: 'state_8_3',
    studentId: 'usr_std_8',
    lectureId: 'lec_2_1',
    courseId: 'crs_ds_301',
    weekId: 'week_2',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 1,
    quizTotalPoints: 3,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-08T20:00:00Z'
  },
  {
    id: 'state_8_4',
    studentId: 'usr_std_8',
    lectureId: 'lec_3_1',
    courseId: 'crs_ds_301',
    weekId: 'week_3',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 1,
    quizTotalPoints: 3,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-15T20:00:00Z'
  },

  // Mahmoud Hamdy (Rank 9 - 5 pts)
  {
    id: 'state_9_1',
    studentId: 'usr_std_9',
    lectureId: 'lec_1_1',
    courseId: 'crs_ds_301',
    weekId: 'week_1',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 2,
    quizTotalPoints: 4,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-01T21:00:00Z'
  },
  {
    id: 'state_9_2',
    studentId: 'usr_std_9',
    lectureId: 'lec_1_2',
    courseId: 'crs_ds_301',
    weekId: 'week_1',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 1,
    quizTotalPoints: 3,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-03T21:00:00Z'
  },
  {
    id: 'state_9_3',
    studentId: 'usr_std_9',
    lectureId: 'lec_2_1',
    courseId: 'crs_ds_301',
    weekId: 'week_2',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 1,
    quizTotalPoints: 3,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-08T21:00:00Z'
  },
  {
    id: 'state_9_4',
    studentId: 'usr_std_9',
    lectureId: 'lec_3_1',
    courseId: 'crs_ds_301',
    weekId: 'week_3',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 1,
    quizTotalPoints: 3,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-15T21:00:00Z'
  },

  // Salma Gamal (Rank 10 - 4 pts)
  {
    id: 'state_10_1',
    studentId: 'usr_std_10',
    lectureId: 'lec_1_1',
    courseId: 'crs_ds_301',
    weekId: 'week_1',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 1,
    quizTotalPoints: 4,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-01T22:00:00Z'
  },
  {
    id: 'state_10_2',
    studentId: 'usr_std_10',
    lectureId: 'lec_1_2',
    courseId: 'crs_ds_301',
    weekId: 'week_1',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 1,
    quizTotalPoints: 3,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-03T22:00:00Z'
  },
  {
    id: 'state_10_3',
    studentId: 'usr_std_10',
    lectureId: 'lec_2_1',
    courseId: 'crs_ds_301',
    weekId: 'week_2',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 1,
    quizTotalPoints: 3,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-08T22:00:00Z'
  },
  {
    id: 'state_10_4',
    studentId: 'usr_std_10',
    lectureId: 'lec_3_1',
    courseId: 'crs_ds_301',
    weekId: 'week_3',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 1,
    quizTotalPoints: 3,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-15T22:00:00Z'
  },

  // Hassan Ali (STD-2024-011) - Rank 11 (3 pts)
  // Demonstrates Privacy: When logged in as Hassan, Top 10 are visible with names, but student 11-13 names are hidden, and Hassan sees his own rank #11
  {
    id: 'state_11_1',
    studentId: 'usr_std_11',
    lectureId: 'lec_1_1',
    courseId: 'crs_ds_301',
    weekId: 'week_1',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 1,
    quizTotalPoints: 4,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-01T23:00:00Z'
  },
  {
    id: 'state_11_2',
    studentId: 'usr_std_11',
    lectureId: 'lec_1_2',
    courseId: 'crs_ds_301',
    weekId: 'week_1',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 1,
    quizTotalPoints: 3,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-03T23:00:00Z'
  },
  {
    id: 'state_11_3',
    studentId: 'usr_std_11',
    lectureId: 'lec_2_1',
    courseId: 'crs_ds_301',
    weekId: 'week_2',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 1,
    quizTotalPoints: 3,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-08T23:00:00Z'
  },

  // Mona Fathy (STD-2024-012) - Has Alarm 1 (2 consecutive absences!)
  // Attended lec 1, missed lec 2 (lec_1_2) and lec 3 (lec_2_1)
  {
    id: 'state_12_1',
    studentId: 'usr_std_12',
    lectureId: 'lec_1_1',
    courseId: 'crs_ds_301',
    weekId: 'week_1',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    attendanceSubmittedAt: '2024-10-01T14:00:00Z',
    quizCompleted: true,
    quizScore: 2,
    quizTotalPoints: 4,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-01T14:30:00Z'
  },
  // Missed lec_1_2 (no attendance record)
  // Missed lec_2_1 (no attendance record) => consecutiveAbsences = 2 => Alarm 1 active!

  // Amr Ezzat (STD-2024-013) - Has Alarm 2 (Performance drop >= 20%)
  // Lec 1: 4/4 (100%), Lec 2: 3/3 (100%), Lec 3: 3/3 (100%) -> previous avg = 100%
  // Lec 4: 1/3 (33%) -> drop of 67% >= 20% => Alarm 2 active!
  {
    id: 'state_13_1',
    studentId: 'usr_std_13',
    lectureId: 'lec_1_1',
    courseId: 'crs_ds_301',
    weekId: 'week_1',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 4,
    quizTotalPoints: 4,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-01T16:00:00Z'
  },
  {
    id: 'state_13_2',
    studentId: 'usr_std_13',
    lectureId: 'lec_1_2',
    courseId: 'crs_ds_301',
    weekId: 'week_1',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 3,
    quizTotalPoints: 3,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-03T16:00:00Z'
  },
  {
    id: 'state_13_3',
    studentId: 'usr_std_13',
    lectureId: 'lec_2_1',
    courseId: 'crs_ds_301',
    weekId: 'week_2',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 3,
    quizTotalPoints: 3,
    quizAttemptsCount: 1,
    quizFinishedAt: '2024-10-08T16:00:00Z'
  },
  {
    id: 'state_13_4',
    studentId: 'usr_std_13',
    lectureId: 'lec_3_1',
    courseId: 'crs_ds_301',
    weekId: 'week_3',
    currentStage: 'completed',
    stage1Completed: true,
    stage2Completed: true,
    attended: true,
    quizCompleted: true,
    quizScore: 1, // 33% (dropped from 100% avg)
    quizTotalPoints: 3,
    quizAttemptsCount: 2,
    quizFinishedAt: '2024-10-15T16:00:00Z'
  }
];

export const INITIAL_CERTIFICATES: Certificate[] = [];

export const INITIAL_ACTIVITY_LOGS: ActivityLog[] = [
  {
    id: 'log_1',
    userId: 'usr_doc_1',
    userName: 'د. عبد الرحمن هاني',
    userAcademicId: 'DOC-101',
    userRole: 'doctor',
    action: 'اعتماد وإصدار شهادة التفوق للطالب أحمد علي حسن',
    timestamp: 'منذ 20 دقيقة',
    type: 'certificate'
  },
  {
    id: 'log_2',
    userId: 'usr_std_1',
    userName: 'أحمد علي حسن',
    userAcademicId: 'STD-2024-001',
    userRole: 'student',
    action: 'إتمام كويز المحاضرة 4 بنتيجة 3/3 نقاط',
    timestamp: 'منذ ساعتين',
    type: 'quiz'
  },
  {
    id: 'log_3',
    userId: 'usr_std_2',
    userName: 'سارة محمد إبراهيم',
    userAcademicId: 'STD-2024-002',
    userRole: 'student',
    action: 'تسجيل حضور المحاضرة 4 وتقييم 5 نجوم',
    timestamp: 'منذ 3 ساعات',
    type: 'attendance'
  },
  {
    id: 'log_4',
    userId: 'usr_doc_1',
    userName: 'د. عبد الرحمن هاني',
    userAcademicId: 'DOC-101',
    userRole: 'doctor',
    action: 'رفع ملف أسئلة وتوليد بنك أسئلة لمحاضرة أشجار AVL',
    timestamp: 'أمس، 02:00 م',
    type: 'admin'
  }
];

export const INITIAL_WHATSAPP_LOGS: WhatsAppNotificationLog[] = [
  {
    id: 'wa_1',
    studentId: 'usr_std_12',
    studentName: 'منى فتحي السويفي',
    phone: '+201099001122',
    messageType: 'consecutive_absence',
    messageText: 'مرحباً منى، تم رصد غيابك في آخر محاضرتين متتاليتين بمقرر هياكل البيانات CS-301. نرجو الدخول للمنصة ومتابعة الشرح وحل الكويز في موعده لتجنب الإنذار الأكاديمي.',
    sentAt: '2024-10-18T10:00:00Z',
    status: 'simulated'
  },
  {
    id: 'wa_2',
    studentId: 'usr_std_13',
    studentName: 'عمرو عزت الجندي',
    phone: '+201500112233',
    messageType: 'performance_drop',
    messageText: 'عزيزي عمرو، لاحظنا هبوطاً في نتيجتك بآخر كويز مقارنة بمستواك المتميز المعتاد. الدكتور مستعد لتقديم المساعدة ومراجعة المفاهيم الصعبة معك.',
    sentAt: '2024-10-18T11:00:00Z',
    status: 'simulated'
  }
];
