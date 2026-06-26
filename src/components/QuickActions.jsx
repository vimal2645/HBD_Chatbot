import { Search, RefreshCw, X, LogIn, MapPin, Type, PlusCircle, Phone, Package, Tag } from 'lucide-react'
import { UI_TRANSLATIONS } from '../constants/Translations'

export default function QuickActions({ onAction, view = 'main', lang = 'en' }) {
  const trans = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS.en;

  // VIEW 1: WELCOME SCREEN (When NOT Logged In)
  if (view === 'welcome_screen') {
    return (
      <div className="flex flex-col gap-2 p-2 animate-in slide-in-from-bottom-2 fade-in duration-500">
        <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold text-center mb-1">
          {trans.how_continue}
        </div>

        <div className="flex gap-2">
          <button onClick={() => onAction('login_trigger')} className="flex-1 flex items-center justify-center gap-2 bg-[#4F46E5] text-white py-1.5 rounded-lg shadow-sm hover:bg-[#4338ca] transition-all font-bold text-[11px]">
            <Phone size={12} /> {trans.btn_phone}
          </button>
          <button onClick={() => onAction('search_method')} className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 py-1.5 rounded-lg hover:bg-gray-50 transition-all font-bold text-[11px]">
            <Search size={12} /> {trans.btn_find}
          </button>
        </div>

        <div className="flex gap-2">
          <button onClick={() => onAction('add_new_business')} className="flex-1 flex items-center justify-center gap-2 bg-green-50 text-green-700 border border-green-100 py-1.5 rounded-lg hover:bg-green-100 transition-all font-bold text-[11px]">
            <PlusCircle size={12} /> {trans.btn_add}
          </button>
          <button onClick={() => onAction('reset_chat')} className="flex-1 flex items-center justify-center gap-2 bg-red-50 text-red-600 border border-red-100 py-1.5 rounded-lg hover:bg-red-100 transition-all font-bold text-[11px]">
            <RefreshCw size={12} /> {trans.btn_reset}
          </button>
        </div>
        <button onClick={() => onAction('close')} className="text-[11px] text-gray-400 text-center py-1 mt-1 hover:text-[#4F46E5] transition-colors font-medium">← {trans.btn_back}</button>
      </div>
    )
  }

  // VIEW 2: SEARCH METHODS (Sub-menu for "Find Business")
  if (view === 'search_sub_menu') {
    return (
      <div className="flex flex-col gap-2 p-2 animate-in slide-in-from-bottom-2 fade-in duration-500">
        <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold text-center mb-1">
          {trans.search_by}
        </div>
        <div className="flex gap-2">
          <button onClick={() => onAction('search_by_name')} className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 py-2 rounded-lg hover:bg-blue-50 hover:border-blue-200 transition-all font-bold text-[11px]">
            <Type size={14} className="text-blue-500" /> {trans.btn_name}
          </button>

          <button onClick={() => onAction('search_by_address')} className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 py-2 rounded-lg hover:bg-blue-50 hover:border-blue-200 transition-all font-bold text-[11px]">
            <MapPin size={14} className="text-blue-500" /> {trans.btn_address}
          </button>
        </div>
        <button onClick={() => onAction('go_back')} className="text-[11px] text-gray-400 text-center py-1 mt-1 hover:text-[#4F46E5] transition-colors font-medium">{`← ${trans.btn_back_menu}`}</button>
      </div>
    )
  }

  // VIEW 3: NO BUSINESS (Logged in but no business found)
  if (view === 'no_business') {
    return (
      <div className="flex flex-col gap-2 p-2 animate-in slide-in-from-bottom-2 fade-in duration-500">
        <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold text-center mb-1">
          {trans.no_biz_linked}
        </div>
        <button onClick={() => onAction('add_new_business')} className="w-full flex items-center justify-center gap-2 bg-[#4F46E5] text-white py-3 rounded-xl shadow-md hover:bg-[#4338ca] transition-all font-bold text-xs">
          <PlusCircle size={16} /> {trans.btn_add_now}
        </button>
        <button onClick={() => onAction('go_back')} className="text-[11px] text-gray-400 text-center py-1 mt-1 hover:text-[#4F46E5] transition-colors font-medium">{`← ${trans.btn_back_menu}`}</button>
      </div>
    )
  }

  // VIEW 4: MAIN (When Logged In)
  if (view === 'main') {
    return (
      <div className="px-3 pt-2 pb-2 flex flex-col gap-2 animate-in slide-in-from-bottom-2">
        <div className="flex gap-2 justify-center">
          <button onClick={() => onAction('search')} className="flex-1 flex items-center justify-center gap-2 bg-blue-50 text-blue-600 border border-blue-100 py-1.5 rounded-lg text-[11px] font-bold hover:bg-blue-100 transition-colors" >
            <Search size={12} /> {trans.btn_show_biz}
          </button>
          <button onClick={() => onAction('update')} className="flex-1 flex items-center justify-center gap-2 bg-green-50 text-green-600 border border-green-100 py-1.5 rounded-lg text-[11px] font-bold hover:bg-green-100 transition-colors">
            <RefreshCw size={12} /> {trans.btn_update_biz}
          </button>
        </div>

        <div className="flex gap-2 justify-center">
          <button onClick={() => onAction('manage_products')} className="flex-1 flex items-center justify-center gap-2 bg-indigo-50 text-indigo-600 border border-indigo-100 py-1.5 rounded-lg text-[11px] font-bold hover:bg-indigo-100 transition-colors">
            <Package size={12} /> {trans.btn_manage_products || 'Manage Products'}
          </button>
          <button onClick={() => onAction('manage_deals')} className="flex-1 flex items-center justify-center gap-2 bg-pink-50 text-pink-600 border border-pink-100 py-1.5 rounded-lg text-[11px] font-bold hover:bg-pink-100 transition-colors">
            <Tag size={12} /> {trans.btn_manage_deals || 'Manage Deals'}
          </button>
        </div>

        <div className="flex gap-2 justify-center">
          <button onClick={() => onAction('start_add_product')} className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white py-1.5 rounded-lg text-[11px] font-bold hover:bg-indigo-700 transition-colors">
            <PlusCircle size={12} /> {trans.btn_add_product || 'Add Product'}
          </button>
          <button onClick={() => onAction('start_add_deal')} className="flex-1 flex items-center justify-center gap-2 bg-pink-600 text-white py-1.5 rounded-lg text-[11px] font-bold hover:bg-pink-700 transition-colors">
            <PlusCircle size={12} /> {trans.btn_add_deal || 'Add Deal'}
          </button>
        </div>

        <div className="flex gap-2">
          <button onClick={() => onAction('go_back')} className="flex-1 text-[11px] text-gray-400 text-center py-1 hover:text-[#4F46E5] transition-colors font-medium">{`← ${trans.btn_back_menu}`}</button>
          <button onClick={() => onAction('reset_chat')} className="flex-1 flex items-center justify-center gap-1 text-red-400 hover:text-red-500 transition-colors text-[10px] font-bold">
            <RefreshCw size={12} /> {trans.btn_reset}
          </button>
        </div>
      </div>
    )
  }

  return null;
}