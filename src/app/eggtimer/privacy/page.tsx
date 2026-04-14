import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Политика конфиденциальности — ЯйцеТаймер',
  description: 'Политика конфиденциальности мобильного приложения ЯйцеТаймер (EggTimer)',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
            Политика конфиденциальности
          </h1>
          <p className="text-slate-400">
            Для мобильного приложения <strong>«ЯйцеТаймер» (EggTimer)</strong>
          </p>
          <p className="text-sm text-slate-500 mt-2">
            Последнее обновление: {new Date().toLocaleDateString('ru-RU')}
          </p>
        </div>

        <div className="space-y-6 text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Общие положения</h2>
            <p>
              Настоящая Политика конфиденциальности описывает принципы работы с информацией при использовании мобильного приложения «ЯйцеТаймер» (далее — «Приложение»). Мы с уважением относимся к личной информации пользователей и стремимся обеспечить её безопасность.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Сбор и использование информации</h2>
            <p>
              Приложение «ЯйцеТаймер» является инструментом для отсчета времени варки яиц и визуализации их состояния.
            </p>
            <p className="mt-2">
              <strong>Мы не собираем, не храним и не передаем третьим лицам ваши персональные данные</strong> (такие как имя, адрес электронной почты, номер телефона и т.д.). Приложение не требует регистрации или создания учетной записи для его использования.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Запрашиваемые разрешения</h2>
            <p>Для обеспечения заявленного функционала Приложению могут потребоваться следующие локальные разрешения на вашем устройстве:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-400">
              <li><strong>Уведомления и звуковые сигналы:</strong> используются исключительно для локального оповещения пользователя о завершении работы таймера.</li>
              <li><strong>Вибрация:</strong> используется для дополнительного тактильного уведомления о готовности.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Изменения в Политике конфиденциальности</h2>
            <p>
              Мы оставляем за собой право вносить изменения в данную Политику. В случае внесения существенных изменений, обновленная версия будет опубликована на этой странице, доступной по постоянному адресу: <a href="https://kwadle.ru/eggtimer/privacy" className="text-blue-400 hover:text-blue-300 underline underline-offset-4 decoration-blue-400/30">https://kwadle.ru/eggtimer/privacy</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Контакты</h2>
            <p>
              Если у вас возникнут вопросы, предложения или замечания относительно данной Политики конфиденциальности или работы самого Приложения, вы можете связаться с нами по электронной почте: <a href="mailto:develop.mdv@gmail.com" className="text-blue-400 hover:text-blue-300 underline underline-offset-4 decoration-blue-400/30">develop.mdv@gmail.com</a>.
            </p>
          </section>
        </div>

        <div className="pt-8 border-t border-slate-800">
          <p className="text-center text-sm text-slate-500">
            © {new Date().getFullYear()} ЯйцеТаймер. Все права защищены.
          </p>
        </div>
      </div>
    </div>
  );
}
