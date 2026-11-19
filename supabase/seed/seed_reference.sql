-- ============================================================================
-- Seed Reference Data (Production-Safe & Idempotent)
-- Reference: docs/DATABASE.md §11.2
-- ============================================================================

INSERT INTO public.sectors (slug, name_ar, name_en, description_ar, description_en, icon_name, sort_order, is_active)
VALUES
  ('fintech', 'التقنية المالية', 'FinTech', 'المدفوعات الرقمية والخدمات المصرفية والتقنية المالية', 'Digital payments, open banking, and financial infrastructure', 'landmark', 1, true),
  ('healthtech', 'التقنية الصحية', 'HealthTech', 'الرعاية الصحية الرقمية والتقنيات الطبية', 'Digital healthcare, diagnostics, and medical platforms', 'heart-pulse', 2, true),
  ('saas', 'البرمجيات السحابية', 'Enterprise SaaS', 'برمجيات الأعمال السحابية وأنظمة المؤسسات', 'B2B cloud software and enterprise workflow automation', 'layers', 3, true),
  ('logistics', 'الخدمات اللوجستية', 'Logistics & Supply Chain', 'سلاسل الإمداد والشحن والتوصيل الذكي', 'Freight, warehousing, and smart fulfillment networks', 'truck', 4, true),
  ('edtech', 'التقنية التعليمية', 'EdTech', 'منصات التعليم الإلكتروني والتدريب المهني', 'Digital learning, upskilling, and academic infrastructure', 'graduation-cap', 5, true),
  ('cleantech', 'الطاقة النظيفة', 'CleanTech & Sustainability', 'الطاقة المتجددة وإدارة الكربون والمياه', 'Renewable energy, climate resilience, and water tech', 'leaf', 6, true),
  ('ecommerce', 'التجارة الإلكترونية', 'E-Commerce & RetailTech', 'البنية التحتية للتجزئة والمنصات التجارية', 'Digital commerce, retail infrastructure, and marketplaces', 'shopping-bag', 7, true),
  ('proptech', 'التقنية العقارية', 'PropTech', 'إدارة العقارات والاستثمار العقاري الذكي', 'Real estate intelligence, brokerage, and asset management', 'building', 8, true),
  ('ai-deeptech', 'الذكاء الاصطناعي والتقنية العميقة', 'AI & DeepTech', 'نماذج الذكاء الاصطناعي والأنظمة المتقدمة', 'Applied artificial intelligence, robotics, and deep tech', 'cpu', 9, true),
  ('consumer', 'المنتجات الاستهلاكية', 'Consumer Tech', 'التطبيقات والخدمات الاستهلاكية الرقمية', 'Digital consumer products, media, and lifestyle platforms', 'sparkles', 10, true)
ON CONFLICT DO NOTHING;

INSERT INTO public.system_settings (setting_key, value, description_ar, description_en, is_public)
VALUES
  (
    'registration.enabled',
    '{"enabled": true}'::jsonb,
    'السماح بتسجيل حسابات جديدة في المنصة',
    'Controls whether new user registrations are accepted',
    true
  ),
  (
    'maintenance.banner',
    '{"enabled": false, "message_ar": "", "message_en": ""}'::jsonb,
    'تنبيه الصيانة العام للمستخدمين',
    'Public maintenance banner configuration',
    true
  ),
  (
    'uploads.max_bytes',
    '{"public_assets": 5242880, "verification_documents": 10485760, "pitch_documents": 26214400}'::jsonb,
    'الحدود القصوى لحجم الملفات المرفوعة بالبايت',
    'Maximum upload size limits in bytes per Storage bucket',
    false
  ),
  (
    'signed_url.ttl_seconds',
    '{"verification_documents": 60, "restricted_pitch_documents": 60, "standard_pitch_documents": 120}'::jsonb,
    'مدة صلاحية الروابط الموقعة بالثواني',
    'Short-lived Signed URL TTL limits in seconds',
    false
  )
ON CONFLICT (setting_key) DO NOTHING;
