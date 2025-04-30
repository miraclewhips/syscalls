import fs from 'fs';

const url_table = 'https://raw.githubusercontent.com/torvalds/linux/refs/heads/master/arch/x86/entry/syscalls/syscall_64.tbl';
const url_definitions = 'https://raw.githubusercontent.com/torvalds/linux/refs/heads/master/include/linux/syscalls.h';

const syscalls = [];

async function init() {
	console.log('fetching data from github');
	const data_table = await (await fetch(url_table)).text();
	const data_definitions = await (await fetch(url_definitions)).text();

	if(!data_table || !data_definitions) {
		console.log('ERROR: could not fetch data');
		process.exit(1);
	}

	for(let row of data_table.split('\n')) {
		row = row.trim();
		if(row.length === 0 || row[0] === '#' || !(/^\d/.test(row))) continue;

		const parts = row.split(/\t+/).map(e => e.trim());
		if(parts[1] === 'x32') continue;

		const syscall = {
			number: parseInt(parts[0]),
			name: parts[2],
			entry: parts[3],
			implemented: true,
		}

		if(syscall.entry === 'sys_mmap') syscall.entry = 'ksys_mmap_pgoff';

		if(!syscall.entry) {
			switch(syscall.name) {
				case 'set_thread_area': syscall.alternative = 'arch_prctl'; break;
				case 'get_thread_area': syscall.alternative = 'arch_prctl'; break;
			}

			syscall.implemented = false;
			syscalls.push(syscall);
			continue;
		}
		
		const def = Array.from(data_definitions.matchAll(new RegExp(String.raw`(?:asmlinkage|unsigned) long ${syscall.entry}\(([^)]+)\);`, 'g')));
		
		if(def[0] && def[0][1]) {
			const args = def[0][1].replaceAll('__user ', '').split(',').map(e => e.trim());
			if(args.length === 1 && args[0] === 'void') {
				syscall.args = [];
			}else{
				syscall.args = args;
			}
		}
		
		// manually fix arguments for definitions in syscalls.h that are missing or have no argument names in their declarations
		switch(syscall.entry) {
			case 'sys_rt_sigaction': syscall.args = ['int sig', 'const struct sigaction *act', 'struct sigaction *oact', 'size_t sigsetsize']; break;
			case 'sys_rt_sigreturn': syscall.args = []; break;
			case 'sys_socket': syscall.args = ['int family', 'int type', 'int protocol']; break;
			case 'sys_connect': syscall.args = ['int fd', 'struct sockaddr *uservaddr', 'int addrlen']; break;
			case 'sys_accept': syscall.args = ['int fd', 'struct sockaddr *upeer_sockaddr', 'int *upeer_addrlen']; break;
			case 'sys_sendto': syscall.args = ['int fd', 'void *buff', 'size_t len', 'unsigned flags', 'struct sockaddr *addr', 'int addr_len']; break;
			case 'sys_recvfrom': syscall.args = ['int fd', 'void *ubuf', 'size_t size', 'unsigned flags', 'struct sockaddr *addr', 'int *addr_len']; break;
			case 'sys_shutdown': syscall.args = ['int fd', 'int how']; break;
			case 'sys_bind': syscall.args = ['int fd', 'struct sokaddr *umyaddr', 'int addrlen']; break;
			case 'sys_listen': syscall.args = ['int fd', 'int backlog']; break;
			case 'sys_getsockname': syscall.args = ['int fd', 'struct sockaddr *usockaddr', 'int *usockaddr_len']; break;
			case 'sys_getpeername': syscall.args = ['int fd', 'struct sockaddr *usockaddr', 'int *usockaddr_len']; break;
			case 'sys_socketpair': syscall.args = ['int family', 'int type', 'int protocol', 'int *usockvec']; break;
			case 'sys_clone': syscall.args = ['unsigned long clone_flags', 'unsigned long newsp', 'void *parent_tid', 'void *child_tid', 'unsigned int tid']; break;
			case 'sys_modify_ldt': syscall.args = ['int func', 'void *ptr', 'unsigned long bytecount']; break;
			case 'sys_arch_prctl': syscall.args = ['int option', 'unsigned long arg2']; break;
			case 'sys_iopl': syscall.args = ['unsigned int level']; break;
			case 'sys_io_submit': syscall.args = ['aio_context_t ctx_id', 'long nr', 'struct iocb **iocbpp']; break;
			case 'sys_pselect6': syscall.args = ['int n', 'fd_set *inp', 'fd_set *outp', 'fd_set *exp', 'struct timespec *tsp', 'void *sig']; break;
			case 'sys_ppoll': syscall.args = ['struct pollfd *ufds', 'unsigned int nfds', 'struct timespec *tsp', 'const sigset_t *sigmask', 'size_t sigsetsize']; break;
			case 'sys_accept4': syscall.args = ['int fd', 'struct sockaddr *upeer_sockaddr', 'int *upeer_addrlen', 'int flags']; break;
		}
	
		// scuffed quick check for any arguments without names to debug any basic errors like missing argument names from definitions
		for(let a of syscall.args) {
			if(a.endsWith('*') || a.split(' ').length === 1 || /[^\s\*]\*/g.test(a)) {
				console.log(`syscall ${syscall.name} has sus arguments`);
			}
		}

		if(syscall.args === undefined) {
			console.log(`ERROR: couldn't find definition for: '${syscall.name} - ${syscall.entry}'`);
			continue;
		}

		// format args
		syscall.args = syscall.args.map(arg => {
			arg = arg.replace(/\*\s+/g, '*').replace(/[\t\s]+/g, ' ').trim();
			const tokens = arg.split(' ');
			tokens[tokens.length - 1] = `<span class="arg-name">${tokens[tokens.length - 1]}</span>`;
			arg = tokens.join(' ');
			return arg;
		});

		syscalls.push(syscall);
	}

	syscalls.sort((a, b) => a.number - b.number);

	console.log('total syscalls:', syscalls.length)

	const template = fs.readFileSync('./template.html', {encoding: 'utf8'});

	const output_data = syscalls.map(syscall => {
		let out = '';
		out += `<tr>`;
		out += `<td class="manual"><a href="https://manpages.debian.org/unstable/manpages-dev/${syscall.name}.2.en.html">&#128464;</a></td>`;
		out += `<td class="number">${syscall.number}</td>`;
		out += `<td class="name" data-name="${syscall.name}">${syscall.name}</td>`;

		if(syscall.implemented) {
			for(let i = 0; i < 6; i++) {
				out += `<td class="arg">${(syscall.args && syscall.args[i]) || (i === 0 ? '-' : '&nbsp;')}</td>`;
			}
		}else{
			let alt = '';
			if(syscall.alternative) {
				alt = `. Use ${syscall.alternative}.`;
			}
			out += `<td class="not-implemented">NOT IMPLEMENTED${alt}</td>`;
			for(let i = 0; i < 5; i++) out += `<td></td>`;
		}

		out += `</tr>`;
		return out;
	}).join('\n');

	const now = new Date();
	const dateString = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`
	const output_html = template.replace('{{ROWS}}', output_data).replace('{{DATE}}', dateString);

	fs.writeFileSync('./index.html', output_html);
	console.log('template written to ./index.html');
}

init();
