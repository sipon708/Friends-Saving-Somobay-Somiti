import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, PartyPopper, Calendar, X } from 'lucide-react';

export function HalKhataPopup() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const now = new Date();
    const isJanuary = now.getMonth() === 0; // 0 is January
    const hasSeen = localStorage.getItem(`halkhata_seen_${now.getFullYear()}`);
    
    if (isJanuary && !hasSeen) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem(`halkhata_seen_${new Date().getFullYear()}`, 'true');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 100 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.5, opacity: 0, y: 100 }}
            className="bg-gradient-to-br from-emerald-600 to-teal-800 rounded-[40px] p-8 w-full max-w-lg relative overflow-hidden shadow-2xl border border-white/20"
          >
            {/* Background Decorations */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute -top-20 -left-20 w-64 h-64 border-8 border-white rounded-full"
              />
              <motion.div 
                animate={{ rotate: -360 }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                className="absolute -bottom-20 -right-20 w-80 h-80 border-8 border-white rounded-full"
              />
            </div>

            <button 
              onClick={handleClose}
              className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-10"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="relative z-10 flex flex-col items-center text-center text-white">
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="bg-white/20 p-4 rounded-3xl mb-6 backdrop-blur-sm"
              >
                <PartyPopper className="w-12 h-12 text-yellow-300" />
              </motion.div>

              <motion.h2 
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-4xl font-black mb-4 leading-tight"
              >
                শুভ হালখাতা ও <br /> নতুন বছরের শুভেচ্ছা!
              </motion.h2>

              <motion.p 
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-emerald-50 text-lg mb-8"
              >
                জানুয়ারি মাস - আমাদের সমিতির বার্ষিক ক্লোজিং ও হালখাতার সময়। <br />
                বিগত বছরের সকল হিসাব সম্পন্ন করে নতুন উদ্যমে শুরু হোক আমাদের পথচলা।
              </motion.p>

              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="grid grid-cols-2 gap-4 w-full"
              >
                <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
                  <Calendar className="w-6 h-6 mb-2 mx-auto text-yellow-300" />
                  <p className="text-xs uppercase tracking-widest opacity-60">বছর</p>
                  <p className="text-xl font-bold">{new Date().getFullYear()}</p>
                </div>
                <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
                  <Sparkles className="w-6 h-6 mb-2 mx-auto text-yellow-300" />
                  <p className="text-xs uppercase tracking-widest opacity-60">অবস্থা</p>
                  <p className="text-xl font-bold">ক্লোজিং</p>
                </div>
              </motion.div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleClose}
                className="mt-10 w-full py-5 bg-yellow-400 text-emerald-900 rounded-2xl font-black text-xl shadow-xl shadow-emerald-900/20"
              >
                ধন্যবাদ, শুরু করুন
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
