import { useState } from 'react';
import { api } from '../services/api';

export const ADD_BIZ_STEPS = [
  { key: 'phone', promptKey: 'prompt_phone' },
  { key: 'email', promptKey: 'prompt_email' },
  { key: 'otp', promptKey: 'prompt_otp' },
  { key: 'name', promptKey: 'prompt_name' },
  { key: 'category', promptKey: 'prompt_cat' },
  { key: 'address', promptKey: 'prompt_addr' },
  { key: 'city', promptKey: 'prompt_city' },
  { key: 'area', promptKey: 'prompt_area' },
  { key: 'state', promptKey: 'prompt_state' }
];

export const getAddProductSteps = (trans) => [
  { key: 'name', prompt: trans.prod_name || "What is the product name?" },
  { key: 'price', prompt: trans.prod_price || "What is the price?" },
  { key: 'category', prompt: trans.prod_cat || "Product category (e.g. Shoes, Electronics)?" },
  { key: 'description', prompt: trans.prod_desc || "Short description?" },
  { key: 'image_url', prompt: trans.prod_img || "Please upload an image for your product (Optional)." }
];

export const getAddDealSteps = (trans) => [
  { key: 'title', prompt: trans.deal_title || "What is the deal title? (e.g. Holi Midnight Sale)" },
  { key: 'discount_pct', prompt: trans.deal_disc || "Discount percentage? (Only numbers)" },
  { key: 'expiry_date', prompt: trans.deal_expiry || "Valid until? (e.g. 2026-04-30)" },
  { key: 'description', prompt: trans.deal_desc || "Tell us more about this offer." }
];

export function useChatWizards({
  session,
  currentLanguage,
  setLocalMessages,
  addThinking,
  removeThinking,
  setSession,
  setIsLoggedIn,
  setQuickActionsView,
  flowMode,
  setFlowMode,
  wizardStep,
  setWizardStep,
  wizardData,
  setWizardData,
  pendingUpdateField,
  setPendingUpdateField
}) {

  const formatFieldName = (field) =>
    field
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const finalizeProduct = async (data) => {
    addThinking();
    const finalData = { 
      ...data, 
      business_id: session.businessId 
    };
    try {
      const res = await api.addProduct(finalData);
      removeThinking();
      setFlowMode('QUERY');
      if (res.success) {
        setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: "✅ Product added successfully!" }]);
      } else {
        setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: "❌ Error: " + (res.detail || "Could not add product.") }]);
      }
    } catch (err) {
      removeThinking();
      setFlowMode('QUERY');
      setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: "❌ Error: " + err.message }]);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    addThinking();
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.uploadImage(formData);

      removeThinking();
      if (res.success) {
        const currentData = { ...wizardData, image_url: res.url };
        setWizardData(currentData);
        setLocalMessages(prev => [...prev, { id: Date.now(), role: 'user', type: 'text', content: 'Image uploaded successfully ✅' }]);
        
        // Finalize (last step)
        finalizeProduct(currentData);
      } else {
        setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: '❌ Upload failed. Please try again.' }]);
      }
    } catch (err) {
      removeThinking();
      setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: '❌ Upload error.' }]);
    }
  };

  const handleImageSkip = () => {
    setLocalMessages(prev => [...prev, { id: Date.now(), role: 'user', type: 'text', content: 'Skipped image ⏭️' }]);
    finalizeProduct({...wizardData, image_url: ""});
  };

  const handleWizardSend = async (text, trans) => {
    const lang = currentLanguage || 'en';
    const cleanText = text.trim().toLowerCase();
    if (cleanText === 'cancel' || cleanText === 'exit' || cleanText === 'quit' || cleanText === 'reset') {
      setFlowMode('QUERY');
      setWizardStep(0);
      setWizardData({});
      setPendingUpdateField(null);
      removeThinking();
      setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: trans.wizard_canceled || "Wizard canceled. You can now search for businesses again." }]);
      return true;
    }

    if (flowMode === 'UPDATE_VALUE') {
      if (pendingUpdateField === 'phone_number') {
        if (!/^\d{10}$/.test(text.replace(/\s+/g, ''))) {
          removeThinking();
          setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: trans.invalid_phone }]);
          return true;
        }
      }
      if (['address', 'name', 'city', 'state', 'area'].includes(pendingUpdateField)) {
        if (/^\d+$/.test(text.trim())) {
          removeThinking();
          const fieldLabel = pendingUpdateField.replace('_', ' ').toUpperCase();
          setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: `❌ ${fieldLabel} ${trans.no_numbers}` }]);
          return true;
        }
      }

      try {
        const res = await api.updateBusiness(session.businessId, pendingUpdateField, text);
        removeThinking();
        
        if (res.success) {
          const fieldLabel = pendingUpdateField.replace('_', ' ');
          const successMsg = lang === 'hi' 
            ? `✅ ${fieldLabel.toUpperCase()} सफलतापूर्वक अपडेट किया गया!` 
            : `✅ ${formatFieldName(fieldLabel)} updated successfully!`;
          setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: successMsg }]);
        } else {
          setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: `❌ ${res.message || 'Error'}` }]);
        }
      } catch (err) {
        removeThinking();
        setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: `❌ ${err.message}` }]);
      }
      
      setFlowMode('QUERY');
      setPendingUpdateField(null);
      return true;
    }

    if (flowMode === 'SEARCH_NAME') {
      try {
        const results = await api.searchByName(text);
        removeThinking();
        if (results.length) {
          const suggestions = results.map(b => ({ title: b.business_name, reason: `${b.area}, ${b.city}`, action: 'claim_business', payload: b }));
          setLocalMessages(prev => [
            ...prev, 
            { id: Date.now(), role: 'bot', type: 'text', content: trans.found_intro }, 
            { id: Date.now() + 1, role: 'bot', type: 'suggestions', content: suggestions }
          ]);
        } else {
          setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: trans.none_found }]);
        }
      } catch (err) {
        removeThinking();
        setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: `❌ ${err.message}` }]);
      }
      setFlowMode('QUERY');
      return true;
    }

    if (flowMode === 'SEARCH_ADDR') {
      try {
        const results = await api.searchByAddress(text);
        removeThinking();
        if (results.length) {
          const suggestions = results.map(b => ({ title: b.business_name, reason: b.area, action: 'claim_business', payload: b }));
          setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'suggestions', content: suggestions }]);
        } else {
          setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: trans.none_nearby }]);
        }
      } catch (err) {
        removeThinking();
        setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: `❌ ${err.message}` }]);
      }
      setFlowMode('QUERY');
      return true;
    }

    if (flowMode === 'ADD_WIZARD') {
      const currentStep = ADD_BIZ_STEPS[wizardStep];
      if (currentStep.key === 'phone') {
        if (!/^\d{10}$/.test(text.replace(/\s+/g, ''))) {
          removeThinking();
          setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: trans.invalid_phone }]);
          return true;
        }
      }
      if (currentStep.key === 'email') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
          removeThinking();
          setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: trans.invalid_email }]);
          return true;
        }
      }
      if (currentStep.key === 'address' || currentStep.key === 'name') {
        if (/^\d+$/.test(text.trim())) {
          removeThinking();
          const fieldLabel = currentStep.key === 'name' ? trans.btn_name : trans.btn_address;
          setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: `❌ ${fieldLabel} ${trans.no_numbers}` }]);
          return true;
        }
      }

      const nextStep = wizardStep + 1;
      const updatedWizardData = { ...wizardData, [currentStep.key]: text };
      setWizardData(updatedWizardData);

      try {
        if (currentStep.key === 'email') {
          await api.sendEmailOtp(text, "registration");
        } else if (currentStep.key === 'otp') {
          const res = await api.verifyEmailOtp(wizardData.email, text);
          if (!res.success) {
            removeThinking();
            setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: '❌ Invalid OTP. Try again.' }]);
            return true;
          }
        }

        if (nextStep < ADD_BIZ_STEPS.length) {
          setWizardStep(nextStep);
          removeThinking();
          const nextBizStep = ADD_BIZ_STEPS[nextStep];
          const nextPrompt = trans[nextBizStep.promptKey] || nextBizStep.promptKey;
          setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: nextPrompt }]);
        } else {
          // Final Step - Complete Registration
          const finalData = { 
            ...updatedWizardData,
            language: lang,
            email: updatedWizardData.email || session.email || "",
            phone: updatedWizardData.phone || session.phone || ""
          };
          console.log("DEBUG: Finalizing Business Registration:", finalData);
          const res = await api.addBusiness(finalData);
          removeThinking();
          setFlowMode('QUERY');
          if (res.success) {
            setSession({
              type: 'BUSINESS',
              phone: finalData.phone || session.phone,
              email: finalData.email || session.email,
              businessId: res.id,
              businessName: finalData.name,
              city: finalData.city
            });
            setIsLoggedIn?.(true);
            setQuickActionsView('main');
            setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: trans.business_added }]);
          } else {
            setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: `❌ ${res.message || 'Error'}` }]);
          }
        }
      } catch (err) {
        removeThinking();
        setFlowMode('QUERY');
        setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: `❌ ${err.message}` }]);
      }
      return true;
    }

    if (flowMode === 'ADD_PRODUCT') {
      const ADD_PRODUCT_STEPS = getAddProductSteps(trans);
      const currentStep = ADD_PRODUCT_STEPS[wizardStep];
      let cleanedValue = text;
      
      if (currentStep.key === 'price') {
        const match = text.replace(/,/g, '').match(/\d+(\.\d+)?/);
        if (!match) {
          removeThinking();
          setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: "❌ Please enter a valid price (e.g. 23000 or 23000.50)." }]);
          return true;
        }
        cleanedValue = parseFloat(match[0]);
      }

      const nextStep = wizardStep + 1;
      const updatedWizardData = { ...wizardData, [currentStep.key]: cleanedValue };
      
      if (nextStep < ADD_PRODUCT_STEPS.length) {
        setWizardData(updatedWizardData);
        setWizardStep(nextStep);
        removeThinking();
        setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: ADD_PRODUCT_STEPS[nextStep].prompt }]);
      } else {
        finalizeProduct(updatedWizardData);
      }
      return true;
    }

    if (flowMode === 'ADD_DEAL') {
      const ADD_DEAL_STEPS = getAddDealSteps(trans);
      const currentStep = ADD_DEAL_STEPS[wizardStep];
      let cleanedValue = text;

      if (currentStep.key === 'discount_pct') {
        const numeric = text.replace(/[^0-9]/g, '');
        if (!numeric || isNaN(parseInt(numeric))) {
          removeThinking();
          setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: "❌ Please enter a valid percentage (numbers only)." }]);
          return true;
        }
        cleanedValue = parseInt(numeric);
      }

      const nextStep = wizardStep + 1;
      const updatedWizardData = { ...wizardData, [currentStep.key]: cleanedValue };

      try {
        if (nextStep < ADD_DEAL_STEPS.length) {
          setWizardData(updatedWizardData);
          setWizardStep(nextStep);
          removeThinking();
          setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: ADD_DEAL_STEPS[nextStep].prompt }]);
        } else {
          const finalData = { 
            ...updatedWizardData,
            business_id: session.businessId
          };
          console.log("Submitting Deal:", JSON.stringify(finalData));
          const res = await api.addDeal(finalData);
          removeThinking();
          setFlowMode('QUERY');
          if (res.success) {
            setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: "✅ Deal posted successfully!" }]);
          } else {
            setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: "❌ Error posting deal." }]);
          }
        }
      } catch (err) {
        removeThinking();
        setFlowMode('QUERY');
        setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: `❌ ${err.message}` }]);
      }
      return true;
    }

    return false; // not in a wizard flow
  };

  return {
    flowMode,
    setFlowMode,
    wizardStep,
    setWizardStep,
    wizardData,
    setWizardData,
    pendingUpdateField,
    setPendingUpdateField,
    handleImageUpload,
    finalizeProduct,
    handleImageSkip,
    handleWizardSend
  };
}
