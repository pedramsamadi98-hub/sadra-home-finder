CREATE TABLE public.properties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  title TEXT NOT NULL,
  property_type TEXT NOT NULL DEFAULT 'apartment',
  transaction_type TEXT NOT NULL DEFAULT 'sale',
  status TEXT NOT NULL DEFAULT 'active',
  city TEXT NOT NULL DEFAULT 'صدرا',
  neighborhood TEXT,
  address TEXT,
  area NUMERIC,
  price BIGINT,
  deposit BIGINT,
  monthly_rent BIGINT,
  bedrooms INTEGER,
  floor INTEGER,
  building_age INTEGER,
  parking BOOLEAN NOT NULL DEFAULT false,
  elevator BOOLEAN NOT NULL DEFAULT false,
  storage BOOLEAN NOT NULL DEFAULT false,
  owner_name TEXT,
  owner_phone TEXT,
  description TEXT,
  notes TEXT,
  photos TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT ALL ON public.properties TO service_role;

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own and sample properties" ON public.properties
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "Users can insert own properties" ON public.properties
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own properties" ON public.properties
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own properties" ON public.properties
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX properties_created_at_idx ON public.properties (created_at DESC);

INSERT INTO public.properties (title, property_type, transaction_type, status, neighborhood, address, area, price, deposit, monthly_rent, bedrooms, floor, building_age, parking, elevator, storage, owner_name, owner_phone, description, notes) VALUES
('آپارتمان ۱۲۰ متری فاز یک', 'apartment', 'sale', 'active', 'فاز ۱', 'بلوار دانش، کوچه ۳', 120, 6500000000, NULL, NULL, 3, 4, 5, true, true, true, 'آقای رضایی', '09171234567', 'آپارتمان نوساز با نور عالی و ویو باز، کابینت ام‌دی‌اف و پارکینگ سندی.', 'مالک برای معاوضه هم آماده است.'),
('آپارتمان ۸۵ متری فاز دو', 'apartment', 'rent', 'active', 'فاز ۲', 'خیابان گلستان، مجتمع یاس', 85, NULL, 500000000, 25000000, 2, 2, 8, true, true, false, 'خانم موسوی', '09361234567', 'واحد تمیز و مناسب زوج جوان، تحویل فوری.', 'رهن و اجاره قابل تبدیل.'),
('ویلا دوبلکس ۲۵۰ متری', 'villa', 'sale', 'active', 'فاز ۳', 'شهرک نگین، خیابان چهارم', 250, 14000000000, NULL, NULL, 4, 0, 3, true, false, true, 'آقای کریمی', '09177654321', 'ویلای دوبلکس با حیاط ۱۰۰ متری، استخر کوچک و انشعابات کامل.', 'فقط نقد.'),
('زمین ۳۰۰ متری مسکونی', 'land', 'sale', 'active', 'فاز ۴', 'انتهای بلوار امام خمینی', 300, 4500000000, NULL, NULL, NULL, NULL, NULL, false, false, false, 'آقای احمدی', '09173334455', 'زمین مسکونی با سند تک‌برگ و پروانه ساخت آماده.', 'موقعیت دو کله.'),
('مغازه ۴۵ متری بر خیابان اصلی', 'commercial', 'rent', 'active', 'فاز ۱', 'بلوار پاسداران، نبش کوچه ۷', 45, NULL, 300000000, 40000000, NULL, 0, 10, false, false, true, 'آقای نوروزی', '09178889900', 'مغازه با موقعیت تجاری عالی، مناسب پوشاک و کافه.', 'سرقفلی جداگانه محاسبه می‌شود.'),
('آپارتمان ۱۰۰ متری فاز پنج', 'apartment', 'sold', 'sold', 'فاز ۵', 'خیابان شهید بهشتی، مجتمع آرام', 100, 5200000000, NULL, NULL, 2, 3, 6, true, true, true, 'خانم شریفی', '09171112233', 'واحد فروش رفته، جهت سابقه ثبت شده است.', 'فروش انجام شد.'),
('ویلا ۱۸۰ متری حیاط‌دار', 'villa', 'rent', 'rented', 'فاز ۲', 'کوچه باغ‌های صدرا', 180, NULL, 700000000, 30000000, 3, 0, 12, true, false, true, 'آقای جعفری', '09175556677', 'ویلای حیاط‌دار اجاره داده شده.', 'قرارداد یک ساله.'),
('دفتر کار ۷۰ متری اداری', 'commercial', 'sale', 'active', 'فاز ۳', 'برج تجاری صدرا، طبقه ۵', 70, 3800000000, NULL, NULL, NULL, 5, 2, true, true, false, 'شرکت عمران صدرا', '07136789012', 'دفتر کار نوساز با آسانسور و پارکینگ اختصاصی.', 'مناسب شرکت‌های کوچک.');