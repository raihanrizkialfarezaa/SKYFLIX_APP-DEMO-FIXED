const fs = require('fs');
const path = require('path');

const cleanup = {
  // Hapus file setelah upload ke Sufy berhasil
  async removeUploadedFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        console.log(`File temporary ${filePath} berhasil dihapus`);
      }
    } catch (error) {
      console.error(`Error saat menghapus file ${filePath}:`, error);
    }
  },

  // Bersihkan semua file di folder uploads yang lebih dari 24 jam
  async cleanupOldFiles() {
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    try {
      const files = await fs.promises.readdir(uploadsDir);
      const now = Date.now();
      
      for (const file of files) {
        const filePath = path.join(uploadsDir, file);
        const stats = await fs.promises.stat(filePath);
        const fileAge = now - stats.mtimeMs;
        
        // Hapus file yang lebih dari 24 jam
        if (fileAge > 24 * 60 * 60 * 1000) {
          await fs.promises.unlink(filePath);
          console.log(`File lama ${file} berhasil dihapus`);
        }
      }
    } catch (error) {
      console.error('Error saat membersihkan file:', error);
    }
  }
};

module.exports = cleanup;